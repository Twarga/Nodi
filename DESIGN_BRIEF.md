# Nodi — UI Design Specification

## 1. What Nodi Is

Nodi is a **self-hosted personal file hub** for your home LAN. It is NOT a collaboration suite like Nextcloud. It is for one person (or one household) to move files between their own devices: laptop → server → phone → TV. Think of it as a private Dropbox / Google Drive replacement that lives on your own hardware.

**Core workflow:**
1. Log in (single user, bcrypt password)
2. Browse folders in a zero-latency SPA
3. Upload from any device (resumable chunked uploads, up to 100 GB)
4. Download / preview files
5. Share read-only links or upload dropboxes on your trusted network
6. Mount storage via WebDAV from desktop/mobile file managers

**Tech constraints:**
- Frontend: Preact + Signals (lightweight React alternative)
- Styling: Tailwind CSS v4 with custom design tokens in `@theme`
- Build tool: Vite
- No external UI libraries (no Material, no Bootstrap, no shadcn/ui)
- Icons are inline SVG only
- Single-page app with client-side routing (7 routes)
- Dark mode is supported via CSS class `.dark` on `<html>`

---

## 2. Pages / Routes

There are exactly 7 routes:

| Route | Path | Purpose |
|-------|------|---------|
| `home` | `/` | Landing page after login |
| `files` | `/files` | File browser (the main workspace) |
| `send` | `/send` | Mobile-friendly upload desk |
| `share` | `/share` | Manage share links and dropboxes |
| `devices` | `/devices` | QR code + LAN URLs + WebDAV setup guides |
| `settings` | `/settings` | Password, storage, trash, backup, health |
| `login` | `/login` | Authentication screen |

---

## 3. Global UI Elements

### 3.1 App Header (TopBar)
- **Logo** (hexagon with stylized "N", teal `#1a8a9e`) + wordmark "Nodi"
- **Nav links**: Files, Send, Share, Devices
- **Theme toggle**: cycles Light → Dark → System (inline SVG moon/sun/monitor icons)
- **User avatar button**: shows user initials, opens dropdown
- **User dropdown**: "Signed in as {name}", Settings link, Sign out (with logout icon)
- Mobile: nav links collapse into the dropdown
- Height: 56px, sticky top, hairline bottom border, no shadow, no card

### 3.2 Upload Panel (fixed bottom-right popup)
- Appears when uploads are active or have history
- Collapsible: shows a header strip when collapsed, full list when expanded
- Groups uploads by folder path
- Each item shows: status icon, filename, percent, size progress, speed, ETA
- Actions per item: pause, resume, retry, cancel
- Global actions: Cancel all active, Clear finished
- Auto-hides 2 seconds after all uploads complete
- Width: full mobile, 420px desktop

### 3.3 Toast Notifications
- Fixed bottom-right stack
- Types: success, error, info
- Auto-dismiss after 4 seconds
- Slide-in from right animation

### 3.4 Keyboard Shortcuts Help Modal
- Triggered by `?` key
- Shows: Esc, Ctrl+A, Enter, Delete, Shift+Click, ?
- Small centered modal overlay

### 3.5 Drag-and-Drop Overlay
- Full-screen overlay appears when dragging files over the window
- Shows "Drop to upload" with upload icon
- Supports files AND folders (structure preserved)
- Backdrop blur effect

---

## 4. Page: Files (`/files`)

This is the most important page. It is a file manager.

### 4.1 Breadcrumbs
- Home icon → folder segments with chevron separators
- Each segment is clickable to navigate up
- "Copy path" button copies current path to clipboard

### 4.2 Page Header
- Folder name (last segment of current path, or "Files" for root)
- Item count subtitle (e.g., "12 items")
- Search mode subtitle (e.g., "3 of 50 results for 'photo'")

### 4.3 Workspace Bar (toolbar)
- **Search input** with search icon and clear button
- **View toggle**: List view vs Grid view (icon buttons)
- **Sort dropdown**: Name, Modified, Size
- **New folder button**
- **Upload button**
- **New file button** (creates empty text file)
- **Upload folder button**
- **Show hidden files toggle**
- **Upload conflict policy dropdown**: Keep both, Skip existing, Replace
- "More" button reveals extra controls (new file, upload folder, hidden files, conflict policy)

### 4.4 File List (List View)
- Header row: checkbox (select all), Name, Size, Modified, empty column for actions
- Each row: checkbox, file type icon, filename (truncated), parent path hint, size, modification date
- Hover reveals a "more actions" ⋮ button
- Click row = open folder or preview file
- Right-click = context menu
- Shift+click = range select
- Keyboard: Ctrl+A = select all, Enter = open, Delete = delete selected

### 4.5 File Grid (Grid View)
- Responsive columns: 2 → 3 → 4 → 5 → 6 based on viewport
- Each item: thumbnail (for images) or large icon, filename, size/folder label
- Checkbox in top-right corner on hover
- Click = open/preview, right-click = context menu

### 4.6 Selection Bar (appears when items selected)
- Shows "{count} selected"
- Actions: Download, Move, Copy, Share, Compress, Delete, Clear selection
- Bulk download compresses multiple items into a zip
- Bulk share creates read links for all selected

### 4.7 Empty State
- Large folder icon
- "This folder is empty"
- "Drop files here or create a new folder to get started"
- Upload button

### 4.8 Loading State
- Skeleton rows that match the list header layout
- Shimmer animation

### 4.9 Context Menu (right-click on file)
- Download (files only)
- Rename
- Move to
- Copy to
- Duplicate
- Details
- Delete (red/destructive)
- Appears at cursor position, flips if near screen edge
- Escape or click outside closes it

### 4.10 File Preview System
Clicking a file opens the appropriate viewer:
- **Images**: Full-screen lightbox with prev/next navigation through all images in the folder
- **Video/Audio**: Media player modal with playback controls
- **PDF**: PDF viewer modal
- **Text/Code**: Syntax-highlighted text preview modal with edit capability
- **Other**: Direct download

### 4.11 Metadata Sidebar (Details)
- Slides in from the right
- Shows: Name, Type, MIME, Size, Modified date, Full path, Parent folder
- SHA-256 hash calculator (with Calculate/Recalculate button, copies to clipboard)
- Action buttons: Download, Share, Open location, Copy path

### 4.12 Modals Used on Files Page
- **Rename**: single text input + Cancel/Rename
- **Delete confirmation**: "Move {name} to trash?" + note about restoring from Settings → Trash + Cancel/Delete
- **New folder**: single text input + Cancel/Create
- **New file**: single text input + Cancel/Create
- **Folder picker**: modal for Move/Copy destination selection, shows folder tree with breadcrumbs
- **Share modal**: create share link for a file/folder
  - Mode: Download only or Upload drop zone (only for folders)
  - Optional password
  - Optional expiration date (datetime-local)
  - For upload mode: max file size, max file count
  - Shows existing shares for this path with revoke/copy actions

---

## 5. Page: Send (`/send`)

Mobile-optimized upload desk. Purpose: quickly send files from phone to server.

### 5.1 Hero Section
- Title: "Drop it here. Pick it there."
- Subtitle explaining it's a fast upload queue for home network

### 5.2 Source Buttons
Four large clickable rows (not cards):
1. **Camera** — opens device camera (capture="environment")
2. **Gallery** — picks photos/videos from library
3. **Files** — any file, supports up to 100 GB
4. **Folder** — preserves folder structure

Each row has: icon, title, description, note (e.g., "Mobile browser"), arrow indicator.

### 5.3 Destination Input
- Text input for folder path (e.g., "phone/uploads")
- Shows resolved destination below (e.g., "Sending to phone/uploads")

### 5.4 Conflict Policy
- Radio buttons: Keep both / Skip / Replace
- Description text for each option

### 5.5 SHA-256 Checkbox
- "Calculate SHA-256 after upload"
- Subtitle explaining it's for server-side checksum

### 5.6 Upload Queue Status
- Shows summary: "3 active uploads" or "Ready for large files"
- Buttons: "Open Files", "Quick upload"

### 5.7 Transfer History
- Last 8 finished uploads
- Each item: filename, group, timestamp, SHA-256 (if calculated), status badge
- Statuses: done (green), skipped (muted), canceled (warning), error (destructive)

### 5.8 Mobile Upload Warning
- When uploads are active: warning banner to keep tab open
- Some phones pause background tabs

---

## 6. Page: Share (`/share`)

Manage existing shares and create new ones.

### 6.1 Stats Header
- Total shares count
- Dropbox count (upload-mode shares)
- Protected count (password-protected shares)

### 6.2 Create Share Form
- **Path input**: folder or file path
- **Mode**: Download link vs Upload dropbox (radio)
- **Expires**: datetime-local input
- **Password**: optional
- **For upload mode**: Max file size (MB), Max files total
- "Create share" button
- On success: link is auto-copied to clipboard

### 6.3 Existing Shares List
- Filter tabs: Active, Expired, Dropboxes, All
- Each share item shows:
  - Badge: Dropbox / Download link
  - Password indicator
  - Expiration indicator
  - Expired status
  - Path name
  - Type (Folder/File) + creation date
  - Copy link button
  - Revoke button
  - Full URL (monospace, truncated)
  - Metadata grid: Expires, Access level, Owner
  - For dropboxes: limits text

### 6.4 Share Activity Log
- Recent share-related events
- Columns: Time, Action, Path

---

## 7. Page: Devices (`/devices`)

Help users access Nodi from other devices on the same LAN.

### 7.1 Hero
- Title: "Put Nodi on every screen in the house."
- Subtitle about QR code, browser, WebDAV

### 7.2 QR Code
- Generated from recommended LAN URL
- Clickable URL below it (copies on click)

### 7.3 Detected Addresses
- Table/list of all detected network interfaces
- Columns: Label, URL, WebDAV URL
- "Best" badge on recommended URL
- Copy buttons for each address

### 7.4 Quick Setup Cards
- Phone browser guide
- Desktop WebDAV guide
- LAN safety warning

### 7.5 Platform Guides (5 platforms)
- Windows network drive
- macOS Finder
- Linux / rclone
- Android file manager
- iPhone / iPad

Each has: title, summary, numbered steps, optional note.

---

## 8. Page: Settings (`/settings`)

Administration and maintenance. NOT for everyday use.

### 8.1 Storage Section
- Big used/total display (e.g., "45 GB of 500 GB")
- Progress bar
- Stats grid: Nodi data size, Free space, File count, Folder count

### 8.2 Health Section
- Status, Uptime, Active uploads, Abandoned uploads, Trash items, Disk free, Upload TTL, Trash retention, Version

### 8.3 Trash Section
- Count of deleted items
- Confirmation input (type "EMPTY")
- "Empty trash" button

### 8.4 Maintenance Section
- Cleanup buttons: Abandoned uploads, Expired trash, Run all cleanup

### 8.5 Change Password
- Current password, New password (min 8), Confirm
- Update password button

### 8.6 Backup & Restore
- "Download backup" button (streaming TAR)
- Restore: type "DELETE" to confirm, then upload .zip or .tar file

### 8.7 Recent Activity
- Table: Time, Action, User, Path
- Last 50 events

### 8.8 About
- Version, Go runtime, Project description
- Back to files link

---

## 9. Page: Home (`/`)

Dashboard landing page after login.

### 9.1 Hero
- Title: "Simple file sharing for your home network."
- Subtitle about uploading from any device

### 9.2 Primary Actions
- "Send files" button (primary)
- "Open files" button (outline)
- "Open on another device" link

### 9.3 Stats Strip
- Uploads status (active/completed count)
- Storage used with percentage
- File count

### 9.4 LAN URL Block
- "Open from another device"
- Clickable recommended URL (copies to clipboard)
- Subtitle explaining same Wi-Fi usage

### 9.5 Recent Files
- Last 4 recently modified files
- Each row: icon, name, parent path, size/type, date
- "View all" link to Files page

---

## 10. Page: Login (`/login`)

Simple centered form.
- Logo + "Nodi" + "Sign in to your home file hub"
- Username input
- Password input
- Error message (border-left destructive accent)
- "Sign in" button with loading spinner
- Footer: "Nodi · self-hosted home file hub"

---

## 11. Data Models

### FileInfo
```ts
interface FileInfo {
  name: string;
  size: number;
  is_dir: boolean;
  mod_time: string; // ISO date
  ext: string;
  mime: string;
  path?: string;
  parentPath?: string;
}
```

### App State
```ts
interface AppState {
  currentPath: string;
  breadcrumbs: { name: string; path: string }[];
  files: FileInfo[];
  viewMode: 'list' | 'grid';
  sortBy: 'name' | 'size' | 'modified';
  sortOrder: 'asc' | 'desc';
  searchQuery: string;
  showHidden: boolean;
  selectedFiles: Set<string>;
  isLoading: boolean;
}
```

### Share
```ts
interface Share {
  token: string;
  path: string;
  is_dir: boolean;
  created_at: string;
  created_by?: string;
  expires_at: string | null;
  has_password: boolean;
  mode: 'read' | 'upload';
  url: string;
  status?: 'active' | 'expired';
  max_file_size?: number;
  max_file_count?: number;
}
```

### TrashItem
```ts
interface TrashItem {
  id: string;
  name: string;
  original_path: string;
  is_dir: boolean;
  size: number;
  deleted_at: string;
}
```

### UploadProgress
```ts
interface UploadProgress {
  file: string;
  loaded: number;
  total: number;
  percent: number;
  status: 'pending' | 'uploading' | 'paused' | 'skipped' | 'done' | 'error';
  error?: string;
  speedBps?: number;
  etaSeconds?: number;
  sha256?: string;
}
```

---

## 12. Design Tokens (Tailwind v4 @theme)

The app uses a custom editorial color system. Key values:

**Light mode:**
- Background: `#fbfbfb`
- Foreground: `#0a0a0a`
- Foreground muted: `#6b7280`
- Foreground subtle: `#9ca3af`
- Surface hover: `#f5f5f5`
- Border: `#e5e5e5`
- Border strong: `#d4d4d4`
- Success: `#15803d`
- Warning: `#b45309`
- Destructive: `#b91c1c`
- Radius: `0.25rem` (very subtle, almost square)

**Dark mode:**
- Background: `#0a0a0a`
- Foreground: `#ededed`
- Surface: `#111111`
- Border: `#262626`

**Typography:**
- Font: Inter system stack
- Display-1: clamp(2.5rem, 5vw + 1rem, 5.25rem), tracking -0.045em, weight 600
- Display-2: clamp(1.875rem, 2.5vw + 1rem, 2.75rem), tracking -0.03em
- Eyebrow: 0.75rem, uppercase, tracking 0.18em, muted color
- Lede: clamp(1rem, 0.5vw + 0.9rem, 1.125rem), line-height 1.55

---

## 13. Backend API Endpoints Summary

All endpoints return JSON except downloads.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/whoami` | GET | Current user |
| `/login` | POST | Authenticate |
| `/logout` | POST | Sign out |
| `/browse` | GET | List folder contents |
| `/api/search` | GET | Full-text file search |
| `/api/upload` | POST | Small file upload (multipart) |
| `/api/upload/start` | POST | Start chunked upload session |
| `/api/upload/chunk` | POST | Upload a chunk |
| `/api/upload/complete` | POST | Finalize chunked upload |
| `/api/upload/status` | GET | Check upload progress |
| `/api/upload/{id}` | DELETE | Cancel upload |
| `/api/download` | GET | Download file or folder zip |
| `/api/thumb` | GET | Image thumbnail |
| `/api/stream` | GET | Stream video/audio |
| `/api/edit` | GET/PUT | Read/save text file |
| `/api/folder/create` | POST | Create folder |
| `/api/file/create` | POST | Create empty file |
| `/api/rename` | POST | Rename file/folder |
| `/api/delete` | POST | Move to trash |
| `/api/duplicate` | POST | Duplicate file |
| `/api/move` | POST | Move file |
| `/api/copy` | POST | Copy file |
| `/api/compress` | POST | Create zip archive |
| `/api/extract` | POST | Extract archive |
| `/api/restore` | POST | Restore from trash |
| `/api/hash` | GET | Calculate SHA-256 |
| `/api/favorite` | GET/POST/DELETE | Favorites |
| `/api/recent` | GET | Recently modified files |
| `/api/trash` | GET/DELETE | List/empty trash |
| `/api/cleanup` | POST | Run maintenance |
| `/api/storage` | GET | Storage stats |
| `/api/health/details` | GET | Health check |
| `/api/password` | POST | Change password |
| `/api/version` | GET | Version info |
| `/api/devices` | GET | LAN URLs and WebDAV |
| `/api/share` | GET/POST | List/create shares |
| `/api/share?token=` | DELETE | Revoke share |
| `/api/activity` | GET | Activity log |
| `/api/backup` | GET | Download TAR backup |
| `/api/restore-backup` | POST | Restore from backup |

---

## 14. User's Design Requirements

**CRITICAL: The user explicitly asked for a VERY SIMPLE, MINIMAL UI.**

What the user wants:
- **Home page**: Too noisy currently. Remove the multi-row stat grids, big hero text, and extra sections. Should be minimal: greeting + main actions + tiny recent list.
- **Files page toolbar**: The current search + sort + view toggle + buttons bar is "extremely messy". Should be stripped down.
- **No card-based UI**: The user hates cards and "a lot of shit happens" type of UI.
- **Only show what we use**: Don't put everything on every page. The Files page should only show what people use daily.
- **Clean, flat, minimal**: Think macOS Finder or Dropbox but even simpler. Hairline borders, no shadows, no rounded cards, no gradients.
- **Editorial aesthetic**: The current design system already leans this way — flat surfaces, typography-driven hierarchy, whitespace instead of cards.

**What the user still needs (must preserve functionality):**
- File browsing (list is fine, grid can be hidden or simplified)
- Search
- Upload
- New folder
- Right-click context menu actions (rename, move, copy, delete, details, download, duplicate, share)
- Preview (images, video, text, PDF)
- Drag and drop upload
- Multi-select with bulk actions
- Share links creation
- Mobile send page
- Settings (trash, password, backup, health)
- Upload progress panel
- Toast notifications

---

## 15. What NOT to Design

Do NOT suggest:
- Using any external UI component libraries (Material UI, Ant Design, Chakra, shadcn, etc.)
- Changing the backend API
- Adding new backend features
- Using emojis instead of SVG icons
- Heavy animations or parallax effects
- Card-based layouts with shadows and heavy borders
- A sidebar navigation (the current top header is preferred)
- Complex dashboard widgets, charts, or data visualization
