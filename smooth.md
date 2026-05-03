# Nodi Smooth — Frontend Redesign Plan

## Why This Exists

The current frontend (`web/static/app.js`, 1342 lines) is a single IIFE that rebuilds the entire DOM via `innerHTML` on every state change. It's slow, janky, unresponsive, and impossible to maintain. This document lays out a complete rebuild using **Preact + Vite + Tailwind CSS** for a smooth, Apple-quality experience.

```
Current:  1300-line IIFE → innerHTML rebuilds → jank
Target:   Component tree → virtual DOM diff → 60fps smooth
```

---

## Architecture Decision: Preact + Vite

| Choice | Rationale |
|--------|-----------|
| **Preact** (3KB) | React-compatible API, tiny bundle, fast virtual DOM |
| **@preact/signals** (1.6KB) | Reactive state without re-renders |
| **Vite** | Instant HMR, optimized builds, Tailwind CSS plugin |
| **Tailwind CSS** | Keep existing design tokens, zero config |
| **framer-motion** | Apple-quality spring animations (via @preact/compat) |
| **@tanstack/virtual** | Virtual scrolling for large directories |
| **Go template SSR** | First paint via server, hydration via Preact |

**Bundle target:** <35KB gzipped (smaller than current 31KB app.js after tree-shaking).

---

## Phase 1: Project Setup & Build Pipeline

### TD-01: Initialize Vite + Preact project
```
web/app/
  package.json         # preact, vite, @preact/preset-vite, tailwindcss
  vite.config.ts       # pluginPreact, proxy to Go :7319
  tailwind.config.ts   # Import existing CSS variables, content paths
  index.html           # Vite entry point
  tsconfig.json
```

- `npm create vite@latest web/app -- --template preact-ts`
- Install: `tailwindcss @tailwindcss/vite`, `@preact/signals`, `framer-motion`
- Proxy `/api/*`, `/static/*`, `/login`, `/logout` to Go backend
- Share Tailwind config with Go templates via identical CSS variables

**Test:** `npm run dev` → opens at :5173, API calls proxy to :7319

---

### TD-02: Migrate Tailwind CSS tokens

- Copy `web/static/input.css` design tokens into `web/app/src/index.css`
- Ensure `darkMode: 'class'`, same `--background`, `--primary`, etc.
- Verify light/dark themes work via `.dark` class on `<html>`
- Build output goes to `web/static/dist/` for Go to serve

**Test:** Page renders with correct colors, theme toggle works

---

### TD-03: Update Go backend for SPA mode

- `GET /` serves `layout.html` which loads Vite dev or production bundle
- `GET /browse?path=*` still returns JSON (already works)
- All other routes unchanged
- Development: Vite dev server proxied through Go
- Production: Go serves `web/static/dist/` as static files

**Test:** Accessing `/` loads the Preact app; API calls work; login redirect works

---

### TD-04: Create API client layer

```
web/app/src/lib/api.ts
  fetchJSON<T>(url, options) → typed response
  auto-injects X-CSRF-Token from cookie
  auto-redirects to /login on 401
  typed interfaces: FileInfo, BreadcrumbSegment, etc.
```

- Single source of truth for all API calls
- CSRF token handled transparently
- 401 → redirect to login (no more stale error toasts)
- TypeScript types for all request/response bodies

**Test:** Manual call to `api.listFiles('/')` returns typed array

---

## Phase 2: Core Application Structure

### TD-05: App shell & routing

```
web/app/src/App.tsx
  Router:       /login → LoginPage, / → DashboardPage
  Providers:    ThemeProvider, AuthProvider
  Layout:       Shared shell (layout.html stays minimal)
```

- Simple hash or path-based routing (no router library needed)
- Auth context provides `session`, `login()`, `logout()`
- Theme context provides `theme`, `toggle()`

### TD-06: Auth provider & login page

```
web/app/src/hooks/useAuth.ts
  Stores: session status, username
  Methods: login(username, password), logout()
  Auto-check: on mount, test auth by fetching /browse
```

```
web/app/src/pages/Login.tsx
  Centered card (matches current design)
  Username + password inputs
  Loading spinner on submit
  Error display + rate-limit feedback
  CSRF token auto-injected by api.ts
```

**Test:** Login with admin/admin → redirects to dashboard, session cookie set

---

### TD-07: Theme provider & toggle

```
web/app/src/hooks/useTheme.ts
  Reads: localStorage 'ql-theme' or prefers-color-scheme
  Cycles: system → light → dark
  Applies: document.documentElement.classList.toggle('dark')
  Signal: theme → reactive update across app
```

- Ports existing T18 logic to Preact signals
- Theme toggle button in TopBar
- Instant transition, no flash of wrong theme

**Test:** Click theme button → page instantly changes, persists on reload

---

## Phase 3: Dashboard Shell & Navigation

### TD-08: TopBar component

```
web/app/src/components/TopBar.tsx
  Left:  Nodi logo SVG (hexagon) + "Nodi" text
  Right: Theme toggle + User pill (first letter, dropdown)
  Dropdown: "Signed in as username", About v1.0, Logout
```

- Same design as current TopBar, but as a Preact component
- Logout calls `POST /logout`, clears auth state
- Sticky header, backdrop blur

**Test:** User pill shows correct initial, dropdown opens/closes, logout works

---

### TD-09: Sidebar component

```
web/app/src/components/Sidebar.tsx
  Collapsible (hamburger toggle on mobile)
  Sections: Quick Nav (Home), Folder Tree, Favorites
  Lazy-loads children on expand
  Highlights current path
  Smooth slide-in/out animation (spring)
```

**Test:** Click folder in sidebar → navigates, highlights, updates file list

---

### TD-10: Breadcrumbs component

```
web/app/src/components/Breadcrumbs.tsx
  Receives: current path segments
  Renders: Home > FolderA > FolderB
  Click: navigates to that level
  Truncates with "…" on mobile
```

**Test:** Click breadcrumb segment → navigates, breadcrumb updates

---

### TD-11: Workspace bar

```
web/app/src/components/WorkspaceBar.tsx
  View toggle: List / Grid icons
  Sort dropdown: Name, Size, Modified (asc/desc)
  New Folder / New File buttons
  Upload / Upload Folder buttons
  Hidden files toggle
  Search input
```

**Test:** Each control triggers the correct action, state persists on nav

---

## Phase 4: File List & Grid (Core Experience)

### TD-12: FileList component (with virtual scrolling)

```
web/app/src/components/FileList.tsx
  Renders: <FileRow> for each visible file
  Virtual scrolling: @tanstack/react-virtual
  Only renders ~20 rows even with 10,000 files
  Smooth scroll, instant response
```

- Header row: Checkbox | Name | Size | Modified | ⋮
- Click row → open folder (animate transition) or preview file
- Checkbox → select file
- ⋮ → context menu

**Test:** Directory with 5000+ files scrolls at 60fps, no lag

---

### TD-13: FileRow component

```tsx
function FileRow({ file, selected, onToggle, onOpen, onContextMenu }) {
  return (
    <li class="group grid grid-cols-[34px_1fr_110px_160px_56px] ..."
        data-selected={selected}>
      <Checkbox checked={selected} onChange={() => onToggle(file)} />
      <FileIcon type={file.mime} />
      <FileName>{file.name}</FileName>
      <FileSize>{file.size}</FileSize>
      <FileDate>{file.modTime}</FileDate>
      <MoreButton onClick={() => onContextMenu(file)} />
    </li>
  )
}
```

- Click row → `onOpen(file)` 
- Click ⋮ → context menu at cursor position
- Hover → subtle background change + show menu button
- Selected → highlight row + checkbox fill
- Double-click → open (if folder) or preview (if file)

**Test:** Click a folder row → pushes path, loads children, smooth transition

---

### TD-14: FileGrid component

```tsx
function FileGrid({ files, ... }) {
  return (
    <div class="grid grid-cols-2 sm:3 md:4 lg:5 gap-3">
      {files.map(f => <FileCard key={f.name} file={f} ... />)}
    </div>
  )
}
```

- Card: icon (or thumbnail) + name + size/date
- Image files: show thumbnail from `/api/thumb`
- Folder: distinct folder icon with color
- Selected: ring highlight

**Test:** Toggle between list/grid, grid shows thumbnails, persists

---

### TD-15: FileCard component

- Same interactions as FileRow but in card layout
- Thumbnail for images, icon for others
- File name truncation, size below

---

### TD-16: Selection system

```
web/app/src/hooks/useSelection.ts
  Signal: Set<string> of selected file paths
  toggle(filePath), selectAll(), clear(), isSelected(path)
```

- Select-all checkbox (indeterminate when partial)
- Selection bar appears with count + "Delete Selected"
- Shift+click for range selection
- Ctrl+A to select all
- Esc to clear

**Test:** Select 3 files → bar shows "3 selected" → bulk delete works

---

## Phase 5: File Actions & Modals

### TD-17: Context menu component

```
web/app/src/components/ContextMenu.tsx
  Position: at cursor (or ⋮ button)
  Actions: Download, Rename, Move to…, Copy to…, Duplicate, Delete
  Close: click outside or Esc
  Animation: scale+opacity spring (200ms)
```

- Hot-rendered at cursor position (portal)
- File-type-aware: no "Download" on folders
- Move/Copy → opens folder picker modal
- Delete → confirmation modal

**Test:** Right-click file → menu appears → click action → works

---

### TD-18: Modal system

```
web/app/src/components/Modal.tsx
  Reusable modal shell
  Backdrop blur + click-to-close
  Escape to close
  Enter to submit
  Animation: scale(0.95)→scale(1) with opacity (spring 200ms)
```

- Create Folder modal (input + Create/Cancel)
- Rename modal (input pre-filled + Rename/Cancel)
- Delete confirmation (name + warning + Delete/Cancel)
- Bulk Delete confirmation (count + list + Delete/Cancel)

### TD-19: Folder picker modal

- For Move/Copy actions
- Shows folder tree
- Select destination → "Move here" / "Copy here"

---

## Phase 6: File Preview & Viewing

### TD-20: Image lightbox

```
web/app/src/components/Lightbox.tsx
  Full-screen overlay
  Image loads with fade-in
  Arrow keys: prev/next image in folder
  Pinch/zoom (or button zoom)
  Close: Esc, click outside, X button
  Swipe left/right on mobile
```

**Test:** Click image → lightbox opens → arrows navigate → Esc closes

---

### TD-21: Video/audio player

```
web/app/src/components/MediaPlayer.tsx
  <video> or <audio> element
  Controls: play, volume, fullscreen
  Streams via /api/stream with Range support
  Close with Esc
```

### TD-22: Text/code preview

```
web/app/src/components/TextPreview.tsx
  Fetch content via /api/edit
  Monospace font, line wrapping
  Line numbers (optional)
  Copy button
  Close with Esc
```

### TD-23: PDF viewer

- `<iframe>` loading the PDF via `/api/download`
- Fullscreen overlay with close button

---

## Phase 7: Upload Experience

### TD-24: Upload panel component

```
web/app/src/components/UploadPanel.tsx
  Slide-in from bottom (spring animation)
  List of uploads with:
    - Filename
    - Progress bar (animated)
    - Cancel button (aborts XHR)
    - Retry button (on failure)
    - Status: Pending → Uploading → Complete / Failed
  Auto-hide 2s after all complete
```

**Test:** Drag file → panel slides in → progress animates → file appears in list

---

### TD-25: Drag-and-drop overlay

```
web/app/src/components/DropOverlay.tsx
  Full-screen when dragging files over window
  Icon + "Drop files to upload"
  Fade in/out transition
  On drop: start upload, hide overlay
```

### TD-26: Upload hook

```
web/app/src/hooks/useUpload.ts
  Manages upload queue (array of pending/active/completed)
  uploadFiles(files, path) → creates XHR per file
  cancel(id), retry(id)
  Signals for progress, status
```

---

## Phase 8: Polish & Performance

### TD-27: Skeleton loading states

```
web/app/src/components/Skeleton.tsx
  Pulsing gray placeholder rectangles
  Show immediately when navigating
  Replace with real content when API responds
  No layout shift (same dimensions)
```

**Test:** Click folder → skeletons appear → content fades in → no visible jump

---

### TD-28: Empty state

```
web/app/src/components/EmptyState.tsx
  Large folder icon
  "This folder is empty"
  Subtext: "Drop files here or create a new folder"
```

### TD-29: Toast notification system

```
web/app/src/hooks/useToast.ts
  Add toast: toast("Deleted", "success")
  Auto-dismiss: 4s fade out
  Stack: multiple toasts stack from bottom-right
  Types: success (green), error (red), info (blue)
```

### TD-30: Keyboard shortcuts overlay

- `?` key shows/hides shortcuts panel
- Lists: Esc, Delete, Ctrl+A, Enter, Backspace, etc.
- Fade in/out

### TD-31: Responsive design pass

- Mobile: Sidebar becomes hamburger drawer
- Mobile: File list single column, simplified
- Mobile: Workspace bar actions collapse into "…" menu
- Touch: larger tap targets (44px min)
- Swipe gesture on lightbox

### TD-32: Accessibility

- All interactive elements: `aria-label`, `role`
- Focus management: trap focus in modals
- Keyboard navigation: full support
- Screen reader: status announcements for toasts
- Color contrast: AA minimum

### TD-33: Performance optimization

- `@tanstack/virtual` for file list (render only visible)
- `lazy()` + `Suspense` for preview components (code split)
- Image thumbnails: load on demand, cache
- Debounced search input
- Prefetch next folder on hover

---

## Phase 9: Testing

### TD-34: Unit tests (Vitest)

- Each component: renders without crashing
- Hooks: correct state transitions
- API client: correct URL construction, CSRF injection

### TD-35: Integration tests

- Login flow: form → POST → redirect → dashboard
- File CRUD: create → rename → delete
- Upload: select file → progress → appears in list
- Theme: toggle → persists across reload

### TD-36: End-to-end tests (Playwright)

- Full user journey: login → browse → upload → preview → delete → logout
- Keyboard shortcuts
- Drag-and-drop upload
- Context menu actions

---

## Phase 10: Build & Deploy

### TD-37: Production build

- `vite build` → outputs to `web/static/dist/`
- `vite build --watch` for development
- Update Dockerfile to:
  1. Stage 1: Node → `npm ci && npm run build` in web/app
  2. Stage 2: Go build (existing)
  3. Stage 3: Copy `web/static/dist/` into Alpine runtime

### TD-38: Update layout.html for SPA

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <link href="/static/dist/assets/index-xxx.css" rel="stylesheet">
  <script type="module" src="/static/dist/assets/index-xxx.js"></script>
</head>
<body>
  <div id="app"></div>
</body>
</html>
```

- Server-side: minimal shell
- Client-side: Preact mounts into `#app`
- CSP nonce injected by Go middleware

### TD-39: Remove old frontend

- Delete `web/static/app.js`
- Remove old `web/templates/components/file-*.html` (no longer needed)
- Keep `layout.html` (simplified), `login.html` (until migrated)
- Keep `web/static/icons.svg`, `web/static/favicon.svg`

---

## Task Summary

| Phase | Tasks | What |
|-------|-------|------|
| 1: Setup | TD-01–04 | Vite, Tailwind, Go SPA mode, API layer |
| 2: Core | TD-05–07 | App shell, auth, theme |
| 3: Shell | TD-08–11 | TopBar, Sidebar, Breadcrumbs, WorkspaceBar |
| 4: Files | TD-12–16 | FileList, FileRow, FileGrid, FileCard, Selection |
| 5: Actions | TD-17–19 | ContextMenu, Modal, FolderPicker |
| 6: Preview | TD-20–23 | Lightbox, MediaPlayer, TextPreview, PDF |
| 7: Upload | TD-24–26 | UploadPanel, DropOverlay, useUpload |
| 8: Polish | TD-27–33 | Skeletons, EmptyState, Toasts, Keyboard, Responsive, A11y, Perf |
| 9: Test | TD-34–36 | Unit, Integration, E2E |
| 10: Deploy | TD-37–39 | Build, layout.html, cleanup |

---

## Component Tree (Final)

```
App
├── ThemeProvider
│   └── AuthProvider
│       ├── LoginPage                        # /login
│       │   └── LoginForm
│       └── DashboardPage                    # /
│           ├── TopBar
│           │   ├── NodiLogo
│           │   ├── ThemeToggle
│           │   └── UserPill → UserMenu
│           ├── Sidebar
│           │   ├── FolderTree
│           │   └── Favorites
│           ├── WorkspaceBar
│           │   ├── ViewToggle
│           │   ├── SortDropdown
│           │   ├── SearchInput
│           │   └── ActionButtons
│           ├── Breadcrumbs
│           ├── SelectionBar
│           ├── FileView
│           │   ├── FileList (virtual)
│           │   │   └── FileRow* (virtual)
│           │   └── FileGrid
│           │       └── FileCard*
│           ├── ContextMenu (portal)
│           ├── Modal (portal)
│           │   ├── CreateFolderModal
│           │   ├── RenameModal
│           │   ├── DeleteModal
│           │   ├── BulkDeleteModal
│           │   └── FolderPickerModal
│           ├── UploadPanel
│           ├── DropOverlay
│           ├── Lightbox (portal)
│           ├── MediaPlayer (portal)
│           ├── TextPreview (portal)
│           └── ToastContainer
└── (layout.html in Go handles CSP nonce / meta)
```

---

## State Architecture (Signals)

```ts
// useAuth.ts
authStatus: Signal<'loading' | 'authenticated' | 'unauthenticated'>
username: Signal<string>

// useTheme.ts
theme: Signal<'system' | 'light' | 'dark'>

// useFiles.ts
currentPath: Signal<string>
files: Signal<FileInfo[]>
sortBy: Signal<string>
sortOrder: Signal<'asc' | 'desc'>
searchQuery: Signal<string>
showHidden: Signal<boolean>
viewMode: Signal<'list' | 'grid'>

// useSelection.ts
selected: Signal<Set<string>>

// useUpload.ts
uploads: Signal<UploadItem[]>

// useToast.ts
toasts: Signal<Toast[]>
```