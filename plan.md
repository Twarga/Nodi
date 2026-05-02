# Nodi — Full Product Specification

> Lightweight, self-hosted web file manager for homelabs and personal cloud replacement.
> This document is the single source of truth. An AI coding agent should be able to implement the entire product from this file alone without asking any questions.

---

## 0. What Is Nodi

Nodi is a **minimalist, self-hosted web file manager** designed to run on low-resource hardware with zero dependencies beyond a single binary and a Docker container.

The user logs in, browses directories via breadcrumbs, uploads files via drag-and-drop, and manages them (download, rename, delete) through a fast, responsive interface. There is no sync client, no office suite, no search indexing, no multi-user complexity, and no cloud tie-ins.

**Target users:** homelab enthusiasts, privacy-focused individuals, creators managing raw assets, and anyone replacing bloated cloud storage with a tool that just works.

**Positioning:** Fills the gap between basic FTP/SFTP (no UI, no mobile friendly) and Nextcloud/Seafile (heavy, over-engineered, high RAM). First truly lightweight, Alpine-native, Tailwind-driven file browser that feels like a modern dashboard but runs on a Raspberry Pi or old laptop without breaking a sweat.

---

## 1. Tech Stack

### Runtime & Deployment
- **Alpine Linux** (base Docker image)
- Chosen for: ~5MB base image, musl libc, security-focused, minimal attack surface
- Targets: Linux (primary), runs anywhere Docker runs

### Backend
- **Go 1.22+** (standard library only where possible)
- `net/http` for routing, `html/template` for server rendering
- `os` / `path/filepath` for secure file operations
- `crypto/subtle` + `golang.org/x/crypto/bcrypt` for auth
- No external web framework. No SQLite unless absolutely required for sessions (prefer signed cookies instead).

### Frontend
- **Tailwind CSS** (pre-compiled via CLI, zero runtime CSS framework)
- **Vanilla JavaScript** (ES6 modules, <15KB total)
- Zero frameworks (no React, Vue, Svelte, htmx, Alpine.js)
- DOM manipulation via `fetch()` for async actions (upload progress, rename, delete)
- Server-rendered HTML for initial load, lightweight client-side hydration only where needed

### Assets & Icons
- SVG icons embedded inline or as a single sprite
- System fonts (`Inter`, `system-ui`, `-apple-system`) — no external font downloads

### Storage
- **Local filesystem** is the single source of truth
- No database. No index. No cache layer.
- Direct `readdir`, `stat`, `open`, `create`, `rename`, `remove` syscalls

---

## 2. Core Interface

The app has a single, focused layout that adapts to screen size. There are no modes, no collapsible sidebars, and no complex navigation trees.

**Layout:** Fixed top bar + fluid content area. Breadcrumbs handle all navigation.

```
┌──────────────────────────────────────────────────────────────────┐
│  TOP BAR (Fixed height ~56px)                                    │
├──────────────────────────────────────────────────────────────────┤
│  BREADCRUMBS & ACTIONS                                           │
│  [🏠 Home / Documents / Photos]           [+ Folder] [⬆ Upload]  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  FILE LIST / GRID AREA (Scrollable, Drop Target)                 │
│                                                                  │
│  📁 Vacation 2024        12 items   2 days ago   [⋮]            │
│  📄 invoice_04.pdf       2.4 MB     1 week ago   [⋮]            │
│  🖼️ sunset.jpg           1.8 MB     3 days ago   [⋮]            │
│  🎬 timelapse.mp4        840 MB     5 hours ago  [⋮]            │
│                                                                  │
│  [Empty State: Drop files here to upload]                        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Feature Specification

### 3.1 Authentication
- Single admin user defined via environment variables (`QL_USER`, `QL_PASS_HASH`)
- Login via POST `/auth/login` → sets secure, HTTP-only, SameSite=Strict session cookie
- Session expiry: 24 hours of inactivity
- Logout clears cookie, redirects to login
- Rate limit: 5 failed attempts per 15 minutes (IP-based)

### 3.2 File Browsing
- Directory listing via `readdir` + `os.Stat`
- Sorted by: type (folders first) → name (A-Z)
- Metadata displayed: name, size (human-readable), modified (relative time), actions menu
- Breadcrumb navigation: each segment is clickable, current segment is non-interactive
- Grid/List toggle: persisted in `localStorage`
- Infinite scroll or pagination: lazy-load rows as user scrolls (virtualization not required for v1; limit initial render to 200 items, load more on scroll)

### 3.3 File Operations
- **Create Folder**: Modal with single input. Validates name (no slashes, no reserved chars).
- **Upload**: Drag-and-drop anywhere on viewport + button trigger. Streams files directly to disk. Shows progress per file. Validates max size (env var, default 2GB).
- **Download**: Direct stream via `Content-Disposition: attachment`. Supports resume via `Range` headers.
- **Rename**: Inline edit or modal. Validates target path doesn't exist.
- **Delete**: Confirmation modal. Recursive delete for folders. Returns to parent if current folder deleted.

### 3.4 Upload Experience
- Drag overlay: full-screen semi-transparent layer with dashed border + icon + "Drop to upload"
- Progress: thin bar below breadcrumbs. Each file gets a row with name, size, percentage, cancel button
- Completion: progress row morphs into standard file row. Toast notification on success/failure
- Chunking: not required for v1. Direct stream with `io.Copy`. Memory capped at 64KB buffer.

### 3.5 Theming
- Light / Dark / System preference
- Toggle in top bar user menu
- Preference saved to `localStorage`
- Tailwind `dark:` variants handle all theme switching
- Zero layout shift on toggle

---

## 4. Data Model

### Session Cookie
```text
Name: ql_session
Flags: HttpOnly, Secure (if HTTPS), SameSite=Strict, Path=/
Payload: HMAC-SHA256 signed JSON { "user": "admin", "exp": 1714567890 }
```

### File Info Object (internal Go struct)
```go
type FileInfo struct {
    Name    string    `json:"name"`
    Size    int64     `json:"size"`     // bytes
    IsDir   bool      `json:"is_dir"`
    ModTime time.Time `json:"mod_time"` // ISO 8601
    Ext     string    `json:"ext"`      // lowercase, without dot
    MIME    string    `json:"mime"`     // detected via canonical extension map
}
```

### Upload State (in-memory, per-request)
```go
type UploadProgress struct {
    Filename string  `json:"filename"`
    Total    int64   `json:"total"`
    Written  int64   `json:"written"`
    Status   string  `json:"status"` // "uploading" | "done" | "error"
    Error    string  `json:"error,omitempty"`
}
```

### Configuration (Environment Variables)
| Variable | Default | Description |
|----------|---------|-------------|
| `QL_USER` | `admin` | Login username |
| `QL_PASS_HASH` | — | bcrypt hash of password (required) |
| `QL_ROOT` | `/data` | Absolute path to served directory |
| `QL_PORT` | `8080` | HTTP listen port |
| `QL_MAX_UPLOAD` | `2147483648` | Max upload size in bytes (2GB) |
| `QL_COOKIE_SECRET` | — | 32-byte random hex for session signing |
| `QL_THEME` | `system` | Default theme (`light`, `dark`, `system`) |

---

## 5. UI Specification

### 5.1 Design System

**Typography:**
- UI font: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`
- Mono font: `ui-monospace, SFMono-Regular, Menlo, monospace` (timestamps, sizes, hex)
- Base size: 14px
- Hierarchy: 12px (secondary), 14px (body), 16px (headings), 20px (modal titles)

**Spacing:** 4px base unit. Use: 4, 8, 12, 16, 20, 24, 32px.
**Borders:** 1px solid. Radius: 6px (buttons, inputs), 8px (cards, modals).
**Shadows:** None. Flat, high-contrast utility aesthetic.

**Color Tokens (Tailwind mapped):**
- Background: `bg-white` / `dark:bg-zinc-950`
- Surface: `bg-zinc-50` / `dark:bg-zinc-900`
- Border: `border-zinc-200` / `dark:border-zinc-800`
- Text Primary: `text-zinc-900` / `dark:text-zinc-100`
- Text Secondary: `text-zinc-500` / `dark:text-zinc-400`
- Accent: `text-blue-600` / `dark:text-blue-400` (links, active states)
- Danger: `text-red-600` / `dark:text-red-400`

**Motion:**
- Page transitions: 150ms ease opacity
- Hover states: 100ms ease background shift
- Progress bars: linear fill, no easing
- Modals: 200ms scale+opacity fade

### 5.2 Top Bar
Height: 56px. Full width. Background: surface. Bottom border: 1px.

Left:
- Wordmark: "Nodi" (16px, font-weight 600)
- Storage pill: "45.2 GB / 512 GB" (12px, muted, right-aligned in pill)

Right:
- Theme toggle: sun/moon icon button (24x24)
- User menu: avatar circle with first initial. Click reveals dropdown: "Logout"

### 5.3 Breadcrumbs & Actions
Height: 48px. Flex row, align center, justify space-between.

Left:
- Breadcrumb segments separated by `›` glyph
- Each segment: 14px, hover underline, cursor pointer
- Current segment: 14px, font-weight 500, non-clickable
- Mobile: truncates middle segments with `...`

Right:
- `+ New Folder` button (outline style)
- `⬆ Upload` button (filled accent style)
- Stack vertically on screens < 640px

### 5.4 File List View (Default)
Container: full width, overflow-y auto.

Header row (sticky top):
- Columns: Name (flex 1), Size (80px), Modified (120px), Actions (40px)
- 12px uppercase, muted, padding 12px 16px

Rows:
- Height: 48px
- Padding: 0 16px
- Hover: background surface variant
- Name cell: icon (20x20) + text (14px), truncate with ellipsis
- Size cell: 13px monospace, right-aligned
- Modified cell: 13px, relative time ("2h ago", "3d ago")
- Actions cell: `⋮` button (20x20), reveals dropdown on click

### 5.5 File Grid View
Container: CSS grid, `grid-template-columns: repeat(auto-fill, minmax(140px, 1fr))`, gap 16px.

Cards:
- Aspect ratio: 1/1
- Background: surface variant, border 1px, radius 8px
- Center: large icon (48x48)
- Bottom: filename (13px, truncate), modified (11px, muted)
- Hover: border accent, slight scale (1.02)
- Click: opens folder or downloads file
- Long press (mobile) or right-click: context menu

### 5.6 Context Menu (Actions Dropdown)
Triggered by `⋮` button or right-click/long-press.
Width: 160px. Padding: 4px. Border: 1px. Radius: 8px. Shadow: subtle.

Items:
- ⬇ Download
- ✏️ Rename
- 🗑️ Delete (red text)

Clicking item closes menu. Hitting `Escape` or clicking outside closes menu.

### 5.7 Modals
Overlay: fixed inset, `bg-black/40`, backdrop blur 2px.
Container: centered, max-width 400px, padding 24px, background surface, border 1px, radius 12px.

**New Folder Modal:**
- Title: "Create New Folder"
- Input: full width, 14px, placeholder "Folder name", auto-focus
- Buttons: Cancel (ghost) / Create (filled)
- Enter submits. Escape cancels.

**Rename Modal:**
- Title: "Rename"
- Input: pre-filled with current name (extension highlighted or locked)
- Buttons: Cancel / Save

**Delete Confirmation:**
- Title: "Delete [name]?"
- Text: "This cannot be undone."
- Buttons: Cancel / Delete (red filled)

### 5.8 Drop Zone & Upload Overlay
Triggered on `dragenter` over window.
Overlay: fixed inset, `bg-blue-500/10` (light) / `bg-blue-500/20` (dark), border 2px dashed accent, radius 16px, margin 24px.
Center: upload icon (48x48), "Drop files to upload" (18px), "Max 2 GB per file" (13px muted).

Progress integration:
- Appears below breadcrumbs
- Each file: name (13px) + progress bar (height 4px, radius 2px) + percentage (12px monospace)
- Cancel button (×) on right

---

## 6. Architecture & File Structure

### Project Layout
```
nodi/
├── cmd/server/main.go              # Entry point, flag parsing, server init
├── internal/
│   ├── auth/
│   │   ├── session.go              # Cookie signing, validation, creation
│   │   └── middleware.go           # Auth guard, CSRF, rate limit
│   ├── handlers/
│   │   ├── auth.go                 # /login, /logout
│   │   ├── files.go                # GET /browse, POST /upload, POST /delete, etc.
│   │   └── render.go               # HTML template execution, JSON helpers
│   ├── storage/
│   │   ├── fs.go                   # Safe path resolution, traversal guard
│   │   ├── upload.go               # Stream writer, progress tracker, size limit
│   │   └── mime.go                 # Extension → MIME mapping
│   └── config/
│       └── env.go                  # Env var parsing, validation, defaults
├── web/
│   ├── static/
│   │   ├── app.js                  # Vanilla JS: drag/drop, fetch wrappers, theme
│   │   └── icons.svg               # Sprite sheet
│   └── templates/
│       ├── layout.html             # Base HTML, Tailwind classes, <head>
│       ├── login.html              # Auth form
│       ├── dashboard.html          # Main file browser
│       ├── components/
│       │   ├── topbar.html
│       │   ├── breadcrumbs.html
│       │   ├── file-row.html
│       │   ├── file-card.html
│       │   └── modal.html
│       └── partials/
│           ├── progress.html
│           └── toast.html
├── Dockerfile                      # Multi-stage: builder → alpine runtime
├── docker-compose.yml              # Volume mapping, ports, env example
└── README.md                       # Setup, env vars, build instructions
```

### Runtime Data Paths
```
/data/                  # Mapped to host directory. Served as root.
/tmp/ql-upload-*/       # Temp staging for uploads (cleaned on success/fail)
```

---

## 7. Request/Response Flow

### Authentication
```
Client → POST /auth/login {user, pass}
Server → Verify bcrypt → Sign session cookie → Set-Cookie → 302 /
Client → Follow redirect → GET / → Render dashboard.html
```

### Browse Directory
```
Client → GET /browse?path=/Documents/Photos
Server → Resolve safe path → readdir + stat → Sort → Render file rows/cards → 200 HTML fragment
Client → Replace #file-container innerHTML → Update breadcrumbs → Update URL (pushState)
```

### Upload File
```
Client → dragover → show overlay
Client → drop → for each file: POST /upload?path=/Documents
Server → Stream request body → write chunk to temp → track progress → move to final path
Server → SSE or polling endpoint returns {filename, written, total, status}
Client → Update progress bars → On 100%: refresh file list → hide overlay
```

### Delete File/Folder
```
Client → POST /delete {path} → Show confirm modal
Server → os.RemoveAll (folder) or os.Remove (file) → 200 JSON {ok: true}
Client → Remove row/card from DOM → Show toast "Deleted"
```

---

## 8. Security & Sanitization

### Path Traversal Prevention
- All user-supplied paths prefixed with `QL_ROOT`
- `filepath.Clean()` applied to every path
- Guard: `!strings.HasPrefix(cleanPath, rootPath) → 403 Forbidden`
- Symlinks followed but validated against root boundary

### Upload Safety
- `http.MaxBytesReader` enforces `QL_MAX_UPLOAD`
- Temp files written to isolated `/tmp/ql-upload-*` directory
- Atomic rename (`os.Rename`) to final destination only after full write
- No executable permission set on uploaded files

### Session Security
- Cookie: `HttpOnly`, `Secure` (if TLS), `SameSite=Strict`, `Path=/`
- Signed with HMAC-SHA256 using `QL_COOKIE_SECRET`
- IP binding optional (env flag)
- Session rotation on login/logout

### Input Validation
- Folder/file names: regex `^[a-zA-Z0-9._ -]+$`
- No `..`, no `/`, no null bytes, no reserved Windows names (`CON`, `PRN`, etc.)
- MIME validation on upload (optional, defaults to extension trust)

---

## 9. Build & Distribution

### Local Development
```bash
# Prerequisites: Go 1.22+, Tailwind CSS CLI
go mod tidy
npx tailwindcss -i ./web/static/input.css -o ./web/static/output.css --watch
go run ./cmd/server
```

### Production Build
```bash
# Compile Tailwind (minified)
npx tailwindcss -i ./web/static/input.css -o ./web/static/output.css --minify

# Build Go binary (stripped, optimized)
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o nodi ./cmd/server

# Docker build
docker build -t nodi:latest .
```

### Docker Compose (Example)
```yaml
services:
  nodi:
    image: nodi:latest
    container_name: nodi
    restart: unless-stopped
    ports:
      - "8080:8080"
    volumes:
      - .//data
    environment:
      - QL_USER=admin
      - QL_PASS_HASH=$2a$12$...
      - QL_ROOT=/data
      - QL_COOKIE_SECRET=$(openssl rand -hex 32)
      - QL_MAX_UPLOAD=2147483648
```

---

## 10. Error Handling

| Error | HTTP Status | Client Behavior |
|-------|-------------|-----------------|
| Invalid credentials | 401 | Shake form, show "Invalid username or password" |
| Expired/invalid session | 401 | Redirect to /login, clear cookie |
| Path traversal attempt | 403 | Toast: "Access denied", log warning |
| File/folder not found | 404 | Show empty state or "Not found" |
| Upload too large | 413 | Toast: "File exceeds 2 GB limit", cancel upload |
| Disk full / write failed | 500 | Toast: "Storage error", cleanup temp files |
| Rate limit exceeded | 429 | Disable login button for 15 minutes |
| Concurrent rename/delete | 409 | Toast: "File changed, refreshing", reload list |
| Network drop during upload | — | Show "Upload interrupted", allow retry |

All server errors logged with request ID, IP, path, and user agent. No stack traces exposed to client.

---

## 11. Performance Requirements

| Metric | Target |
|--------|--------|
| Binary size | < 15 MB |
| Docker image size | < 25 MB |
| Cold start time | < 100 ms |
| Idle RAM usage | < 40 MB |
| Directory render (10k files) | < 200 ms (virtualized or paginated) |
| Upload throughput | Limited only by disk/network (zero-copy streaming) |
| Theme toggle latency | < 50 ms (no repaint flash) |
| Max concurrent uploads | 3 (queue others) |
| Lighthouse performance score | 95+ (mobile & desktop) |

---

## 12. Phase Plan

### Phase 0 — Scaffold & Auth (Day 1–2)
- Go project init, module setup
- Tailwind CLI config, base layout template
- Session cookie system, bcrypt login flow
- Dockerfile + compose working
- Basic `/login` and `/` routing

### Phase 1 — Core File Ops & UI (Day 3–5)
- Secure path resolution + traversal guard
- `GET /browse` → render list/grid views
- Breadcrumb navigation + URL pushState
- Create folder modal + validation
- Delete confirmation + `os.RemoveAll`
- Rename flow + atomic validation

### Phase 2 — Upload & Polish (Day 6–8)
- Drag-and-drop overlay + `fetch()` streaming upload
- Progress tracking (server SSE or polling)
- File icons by extension + relative timestamps
- Dark/light theme toggle + `localStorage` persistence
- Toast notifications + error boundary handling
- Mobile responsive adjustments

### Phase 3 — Hardening & Release (Day 9–10)
- Rate limiting on auth
- Upload size limits + temp cleanup
- Security audit (headers, CSP, cookie flags)
- Performance tuning (buffer sizes, connection pooling)
- README, env template, docker-compose example
- v1.0.0 tag + GitHub release

---

## 13. Out of Scope (v1)

- Search or file indexing
- Multi-user or role-based access
- File preview (images, PDFs, videos)
- Public share links or expiration
- Version history or trash bin
- Desktop/mobile sync clients
- WebDAV or REST API
- Activity logs or audit trails
- Quotas or storage limits per user
- Plugin system or theming engine
- Offline mode or PWA installation

These may be added in v2 based on user demand. v1 remains strictly focused on upload, browse, manage.

---

## 14. License Considerations

- **Go standard library**: BSD 3-Clause
- **Tailwind CSS**: MIT
- **Nodi codebase**: MIT or Apache 2.0 (maintainer choice)
- **No third-party JS frameworks** → zero dependency audit required
- **Alpine Linux**: MIT/GPL mixed (standard distro compliance)
- **Icons**: Custom SVG or public domain (e.g., Heroicons MIT)

Commercial use permitted. No attribution required. No patent grants.

---

## 15. Nothing Is Open

Every question has an answer in this document. Every screen has a layout. Every file operation has a syscall mapping. Every security edge case has a guard. Every environment variable has a default. Every error has a status code and client behavior.

The next step is: start Phase 0. Initialize the repo, scaffold the Go binary, wire the Tailwind layout, and ship the first commit.
