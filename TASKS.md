# Nodi Task Breakdown

## Completed Tasks (T1–T55)
All tasks from Phase 0 through Phase 10 (T1–T55) are done.

---

## Phase 11: Critical Security Fixes (must ship before anything else)

- [x] T56: **CSRF protection**. Add a per-session CSRF token to all state-changing endpoints (`/api/folder/create`, `/api/delete`, `/api/rename`, `/api/upload`, `/login`). Use double-submit cookie pattern. Inject token into templates. All JS fetch calls must send `X-CSRF-Token` header.
- [x] T57: **Fix XSS in server-rendered filenames**. Remove all inline `onclick`/`on*` attributes from templates that embed `{{.Name}}`. Replace with event delegation in app.js using `data-*` attributes only. Go templates escape HTML attributes safely but not JS string contexts.
- [x] T58: **Fix username enumeration in login**. Return identical error message ("Invalid credentials") regardless of whether username exists or password is wrong.
- [x] T59: **Enforce POST-only on `/logout`**. Reject GET with 405. Prevents `<img src="/logout">` forced-logout attacks.
- [x] T60: **Fix upload file handle leak**. Move `defer src.Close()` inside per-file loop so each handle closes immediately, not after entire multipart request finishes.
- [x] T61: **Add CSP nonce**. Replace `unsafe-inline` in Content-Security-Policy with per-request nonce. Inject into `<script>` and `<style>` tags.

---

## Phase 12: Production Hardening (server reliability)

- [x] T62: **Cache templates at startup**. Parse all templates once in `main()`. Pass `*template.Template` to handlers. No more `template.ParseFiles()` per request.
- [x] T63: **Add HTTP server timeouts and graceful shutdown**. (Already implemented in T155)
- [x] T64: **Add static asset cache headers**. `Cache-Control: public, max-age=86400, immutable` for `/static/`. Immutable headers for fingerprinted assets.
- [x] T65: **Validate config on startup**. (Already implemented in T156)
- [x] T66: **Support X-Forwarded-For in rate limiter**. Extract real IP from `X-Forwarded-For`/`X-Real-Ip` when behind trusted proxy. Add `QL_TRUSTED_PROXY` env var.
- [x] T67: **Add session revocation**. On logout, rotate cookie secret server-side to invalidate all sessions (acceptable for single-user).

---

## Phase 13: File Manager Core Features (make it usable)

- [x] T68: **Fix missing SVG icons**. Added `icon-more-vertical`, `icon-check-circle`, `icon-alert-circle`, `icon-upload-cloud`, `icon-x`, `icon-video`.
- [x] T69: **Add file overwrite protection**. Return 409 Conflict when uploading a file that exists. Show toast "File already exists — overwrite?" with confirm button.
- [x] T70: **Relax `validName()`**. Allow `'`, `&`, `"` in filenames. Only reject `/`, `\`, null bytes, control chars.
- [x] T71: **Add pagination to `/browse`**. `?page=N&limit=M` query params. Include `total` and `hasMore` in JSON. Default limit: 200.
- [x] T72: **Add sorting controls**. `?sort=name|size|modified&order=asc|desc` on `/browse`. Default: folders-first, then alpha.
- [x] T73: **Add filename search/filter**. `?search=q` server param for case-insensitive match.
- [x] T74: **Add move/copy between folders**. `POST /api/move {src, dst}` and `POST /api/copy {src, dst}` endpoints with recursive copy support.
- [x] T75: **Add keyboard shortcuts**. `Esc` close modal/clear selection, `Delete` delete selected, `Ctrl+A` select all, `Enter` open, `Backspace` go up.

---

## Phase 14: File Operations (real file manager essentials)

- [x] T76: **Compress to archive (ZIP)**. `POST /api/compress {paths: [...]}` streams selected files/folders as ZIP.
- [x] T77: **Extract archive (ZIP/TAR/GZ)**. `POST /api/extract {path}` with zip slip protection.
- [x] T78: **Create empty file**. `POST /api/file/create {path, name}` endpoint.
- [x] T79: **Inline text editor**. `GET/PUT /api/edit?path=` endpoint, ≤1MB, rejects binary files.
- [x] T80: **Trash/recycle bin**. Delete moves to `.trash/`, restore endpoint, preserve original paths.
- [x] T81: **Duplicate file/folder**. `POST /api/duplicate {path}` copies with " (copy)" suffix.
- [x] T82: **Download directory as ZIP**. `GET /api/download?path=/folder&format=zip` streams directory as ZIP.

---

## Phase 15: File Preview & Viewing

- [x] T83: **Image thumbnail generation**. `GET /api/thumb?path=&size=sm|md|lg` with JPEG caching in `.cache/thumbs/`.
- [x] T84: **Image preview with zoom/lightbox**. Click image → full-screen lightbox, arrow keys to navigate.
- [x] T85: **Video/audio streaming**. `/api/stream?path=` with range support, inline player for media files.
- [x] T86: **PDF viewer**. Click PDF → embedded iframe viewer.
- [x] T87: **Text/code preview**. Click text/code files → monospace preview modal via /api/edit.
- [x] T88: **File metadata panel**. File info modal showing name, size, type, extension, modified date.

---

## Phase 16: Upload & Download Improvements

- [x] T89: **Resumable chunked uploads**. POST chunk, complete endpoints with flowId tracking.
- [x] T90: **Folder upload**. `webkitdirectory` input with dedicated folder upload button.
- [x] T91: **Upload cancel and retry**. Cancel button aborts XHR, retry re-queues the file.
- [x] T92: **Multi-file download as ZIP**. Covered by T76 /api/compress endpoint.
- [x] T93: **Drag-and-drop move between folders**. Drag file onto folder to move via /api/move.

---

## Phase 17: Navigation & Browsing

- [x] T94: **Sidebar directory tree**. Collapsible sidebar showing folders, highlights current path.
- [x] T95: **Show/hide hidden files toggle**. Button toggles dotfile visibility, persisted in localStorage.
- [x] T96: **Recent files view**. `/api/recent` returns files modified in last 7 days.
- [x] T97: **Favorites/bookmarks**. `/api/favorite` POST/DELETE stores in `.nodifav.json`.
- [x] T98: **Deep-link to files and folders**. Already supported via `?path=` URL parameter.
- [x] T99: **File type icons**. Already have distinct icons in icons.svg for all types.

---

## Phase 18: Frontend Redesign (Preact + Vite) — SEE smooth.md

> **ALL frontend work is now replaced by the Preact + Vite rebuild detailed in [smooth.md](./smooth.md).**
> The current vanilla JS frontend (`web/static/app.js`, `web/templates/components/`) will be replaced
> with a Preact + Vite + Tailwind CSS application. 39 tasks (TD-01 through TD-39) cover the full rebuild.
>
> **DO NOT continue with T100–T156 until smooth.md tasks are complete.**

---

## Phase 19: Sharing & Multi-User (v2 — after frontend rebuild)

- [ ] T115: **Public share links**. `POST /api/share {path, expiresAt, password?}` generates a unique URL. `GET /s/{token}` serves the shared resource. Store shares in `.nodishare.json`.
- [ ] T116: **Share expiry and revocation**. Shares auto-expire at configured time. Owner can revoke at any time.
- [ ] T117: **Read-only vs upload-only share modes**. Enforce per-share permissions on server.
- [ ] T118: **Activity log**. Store operations in `.nodilog.jsonl` (append-only). Show in admin panel.
- [ ] T119: **Storage usage dashboard**. Compute disk usage, show in TopBar storage bar.
- [ ] T120: **Admin settings UI**. `/settings` page for password changes, session management, share management.
- [ ] T120b: **Full backup download**. `GET /api/backup` streams QL_ROOT as ZIP with progress.
- [ ] T120c: **Backup restore from upload**. `POST /api/restore` accepts ZIP, validates, merges.

## Phase 20: Documentation — SEE smooth.md

> Documentation tasks are now covered by the frontend rebuild as the docs will be rewritten to
> reflect the new Preact + Vite architecture. See smooth.md for details.

## Phase 21: Repository & Project Setup

- [x] T130: **Add LICENSE file**.
- [x] T131: **Fix go.mod module path**.
- [x] T132: **Fix go.mod Go version**.
- [x] T133: **Fix Dockerfile base images**.
- [x] T134: **Update plan.md**.
- [x] T135: **Remove `front-end inspiration/` from git**.
- [x] T136: **Delete `web/templates/test.html`**.
- [x] T137: **Add `.editorconfig`**.
- [x] T138: **Optimize `logo.png`**.

## Phase 22: CI/CD & Automation

- [x] T139: **Add Go CI workflow**.
- [x] T140: **Fix docker-publish.yml**.
- [x] T141: **Add release workflow**.
- [x] T142: **Add Dependabot config**.
- [x] T143: **Add issue and PR templates**.
- [x] T144: **Add branch protection rules docs**.

## Phase 23: Build System & Developer Experience

- [x] T145: **Create Makefile**.
- [x] T146: **Improve run.sh**.
- [x] T147: **Improve install.sh**.
- [x] T148: **Improve docker-compose.yml**.
- [x] T149: **Update .env.example**.

## Phase 24: Monitoring, Health & Operations

- [x] T150: **Add dev container / Docker Compose override**.
- [x] T151: **Add `/api/health` endpoint**.
- [x] T152: **Add `/api/version` endpoint**.
- [x] T153: **Add request logging with request IDs**.
- [x] T154: **Add metrics endpoint**.
- [x] T155: **Add graceful shutdown**.
- [x] T156: **Add startup self-check**.