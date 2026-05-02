# Nodi Task Breakdown

## Completed Tasks (T1–T55)
All tasks from Phase 0 through Phase 10 (T1–T55) are done.

---

## Phase 11: Critical Security Fixes (must ship before anything else)

- [ ] T56: **CSRF protection**. Add a per-session CSRF token to all state-changing endpoints (`/api/folder/create`, `/api/delete`, `/api/rename`, `/api/upload`, `/login`). Use double-submit cookie pattern. Inject token into templates. All JS fetch calls must send `X-CSRF-Token` header.
- [ ] T57: **Fix XSS in server-rendered filenames**. Remove all inline `onclick`/`on*` attributes from templates that embed `{{.Name}}`. Replace with event delegation in app.js using `data-*` attributes only. Go templates escape HTML attributes safely but not JS string contexts.
- [ ] T58: **Fix username enumeration in login**. Return identical error message ("Invalid credentials") regardless of whether username exists or password is wrong.
- [ ] T59: **Enforce POST-only on `/logout`**. Reject GET with 405. Prevents `<img src="/logout">` forced-logout attacks.
- [ ] T60: **Fix upload file handle leak**. Move `defer src.Close()` inside per-file loop so each handle closes immediately, not after entire multipart request finishes.
- [ ] T61: **Add CSP nonce**. Replace `unsafe-inline` in Content-Security-Policy with per-request nonce. Inject into `<script>` and `<style>` tags.

---

## Phase 12: Production Hardening (server reliability)

- [ ] T62: **Cache templates at startup**. Parse all templates once in `main()`. Pass `*template.Template` to handlers. No more `template.ParseFiles()` per request.
- [ ] T63: **Add HTTP server timeouts and graceful shutdown**. Configure `ReadTimeout: 10s`, `WriteTimeout: 30s`, `IdleTimeout: 120s`. Handle SIGINT/SIGTERM with `signal.NotifyContext` for graceful drain.
- [ ] T64: **Add static asset cache headers**. `Cache-Control: public, max-age=86400` for `/static/`. Immutable headers for fingerprinted assets.
- [ ] T65: **Validate config on startup**. Verify `QL_ROOT` exists and is a directory. Verify `QL_COOKIE_SECRET` is ≥32 bytes. Verify `QL_PORT` is numeric. Fail fast with clear messages.
- [ ] T66: **Support X-Forwarded-For in rate limiter**. Extract real IP from `X-Forwarded-For`/`X-Real-Ip` when behind trusted proxy. Add `QL_TRUSTED_PROXY` env var.
- [ ] T67: **Add session revocation**. On logout, rotate cookie secret server-side to invalidate all sessions (acceptable for single-user).

---

## Phase 13: File Manager Core Features (make it usable)

- [ ] T68: **Fix missing SVG icons**. Add `icon-more-vertical`, `icon-check-circle`, `icon-alert-circle`, `icon-upload-cloud` to `icons.svg`. Verify all references resolve.
- [ ] T69: **Add file overwrite protection**. Return 409 Conflict when uploading a file that exists. Show toast "File already exists — overwrite?" with confirm button.
- [ ] T70: **Relax `validName()`**. Allow `'`, `&`, `"` in filenames. Only reject `/`, `\`, null bytes, control chars.
- [ ] T71: **Add pagination to `/browse`**. `?page=N&limit=M` query params. Include `total` and `hasMore` in JSON. Frontend shows "Load more" button. Default limit: 200.
- [ ] T72: **Add sorting controls**. `?sort=name|size|modified&order=asc|desc` on `/browse`. Default: folders-first, then alpha. Sort UI buttons in workspace bar. Persist choice in localStorage.
- [ ] T73: **Add filename search/filter**. Search input in workspace bar. Client-side filter for small dirs. `?search=q` server param for large dirs. Highlight matches.
- [ ] T74: **Add move/copy between folders**. `POST /api/move {src, dst}` and `POST /api/copy {src, dst}`. Context menu "Move to…"/"Copy to…" with folder tree picker. Multi-select bulk move/copy.
- [ ] T75: **Add keyboard shortcuts**. `Esc` close modal/clear selection, `Delete` delete selected, `Ctrl+A` select all, `Enter` open, `Backspace` go up. Show `?` help overlay.

---

## Phase 14: File Operations (real file manager essentials)

- [ ] T76: **Compress to archive (ZIP)**. `POST /api/compress` endpoint. Select files/folders → "Download as ZIP". Server streams ZIP back using `archive/zip`. Show progress toast.
- [ ] T77: **Extract archive (ZIP/TAR/GZ)**. `POST /api/extract` endpoint. Right-click a `.zip`/`.tar`/`.tar.gz` → "Extract here" or "Extract to…". Use `archive/zip` and `archive/tar`. Show error for nested zips exceeding depth limit.
- [ ] T78: **Create empty file**. Add "New File" button next to "New Folder" in workspace bar. `POST /api/file/create {path, name}`. Creates empty file via `os.Create`.
- [ ] T79: **Inline text editor**. `GET /api/edit?path=` returns raw file content. Frontend shows code editor (textarea with monospace font + line numbers) for text files ≤1MB. `PUT /api/edit?path=` saves content. Detect encoding. Reject binary files.
- [ ] T80: **Trash/recycle bin**. Instead of `os.RemoveAll`, move deleted items to `.trash/` inside QL_ROOT. Auto-purge items older than 30 days on startup. Add "Trash" view in sidebar showing deleted items with "Restore" and "Permanent Delete" options. `POST /api/restore {path}` moves from trash back.
- [ ] T81: **Duplicate file/folder**. `POST /api/duplicate {path}`. Creates a copy with " (copy)" suffix. Uses `io.Copy` for files, recursive copy for directories.
- [ ] T82: **Download directory as ZIP**. `GET /api/download?path=/folder&format=zip`. If path is a directory, stream a ZIP. Show progress indicator for large dirs.

---

## Phase 15: File Preview & Viewing

- [ ] T83: **Image thumbnail generation**. `GET /api/thumb?path=&size=sm|md|lg`. Generate thumbnails on-the-fly for images (jpg, png, gif, webp) using `image/jpeg` resize. Cache thumbnails in `.cache/thumbs/`. Show thumbnails in grid view instead of generic file icon.
- [ ] T84: **Image preview with zoom**. Clicking an image opens full-screen lightbox modal. Pinch/spread to zoom. Arrow keys to navigate between images in current folder. Close with Esc or click outside.
- [ ] T85: **Video/audio streaming**. `GET /api/stream?path=` with `Content-Range` header support. For video (mp4, webm, mkv) and audio (mp3, ogg, flac) files, show inline player in preview modal. Use `http.ServeFile` with range support.
- [ ] T86: **PDF viewer**. For `.pdf` files, embed a `<object>` or `<iframe>` with the download URL. Falls back to download link if browser doesn't support inline PDF.
- [ ] T87: **Text/code preview with highlighting**. For text, code, config, and markdown files ≤2MB, show a read-only preview modal with syntax highlighting (use highlight.js from CDN or self-hosted). Line numbers. Copy button. For markdown, render HTML.
- [ ] T88: **File metadata panel**. Click file → sidebar or modal shows: name, size, MIME type, modified time, permissions (octal), path. For images: dimensions, EXIF (orientation, camera, date taken). For audio: duration, bitrate.

---

## Phase 16: Upload & Download Improvements

- [ ] T89: **Resumable chunked uploads (tus protocol or simplified)**. Upload large files in chunks (5MB). Resume interrupted uploads. Store chunks in `.cache/uploads/`. Assemble on completion. Show detailed progress bar per file.
- [ ] T90: **Folder upload**. Add `webkitdirectory` attribute to file input. Preserve directory structure on server. Show folder tree in upload panel during upload.
- [ ] T91: **Upload cancel and retry**. Add cancel button per file in upload panel. On failure, show retry button. Don't auto-retry more than 3 times.
- [ ] T92: **Multi-file download as ZIP**. Select multiple files → "Download selected as ZIP". Server creates temporary ZIP and streams it. Clean up temp file after sending.
- [ ] T93: **Drag-and-drop move between folders**. Drag a file/folder row onto a breadcrumb or folder icon to move it. Show blue highlight on valid drop targets. Uses `/api/move` endpoint.

---

## Phase 17: Navigation & Browsing

- [ ] T94: **Sidebar directory tree**. Add a collapsible left sidebar showing the full directory tree. Click to navigate. Highlight current path. Load children lazily on expand.
- [ ] T95: **Show/hide hidden files toggle**. Add eye toggle button in workspace bar. Persist preference in localStorage. `?showHidden=true` on `/browse` to include dotfiles.
- [ ] T96: **Recent files view**. Add "Recent" tab/icon in sidebar. `GET /api/recent` returns files modified in last 7 days sorted by mtime descending. Show in same list/grid view.
- [ ] T97: **Favorites/bookmarks**. Star a folder to add it to a sidebar "Favorites" section. Store in `.nodifav.json` in QL_ROOT. `POST /api/favorite {path}` and `DELETE /api/favorite {path}`.
- [ ] T98: **Deep-link to files and folders**. URL reflects current path: `/browse?path=/documents/reports`. Copy-path button copies current URL. Shareable links.
- [ ] T99: **File type icons**. Extend `icons.svg` with distinct icons for: PDF, image, video, audio, archive, code, text, spreadsheet, presentation. Match colors to `--icon-*` CSS variables. Use `GetMIME()` to pick icon.

---

## Phase 18: Frontend Polish (make it feel professional)

- [ ] T100: **Redirect 401 to /login**. All JS fetch calls that get 401 should `window.location = '/login'`. No more generic error toast on session expiry.
- [ ] T101: **Clean up app.js**. Remove duplicate `onCreateFolderSubmit`. Remove dead `originalOnDeleteConfirm`/`originalOnRenameSubmit` references. Reduce file size.
- [ ] T102: **Remove `test.html`**. Delete `web/templates/test.html`.
- [ ] T103: **Dynamic version**. Replace hardcoded `v1.0` with Go template variable from build info (`debug.ReadBuildInfo` or ldflags).
- [ ] T104: **Grid view shows size and date**. Add formatted size and relative date to each grid card in `renderFileCard`.
- [ ] T105: **Right-click context menu**. Replace `...` button dropdown with a native right-click context menu. Show same options (rename, copy, move, download, delete). Also keep `...` button for touch/mobile.
- [ ] T106: **Loading skeletons**. Show skeleton placeholder rows while `/browse` is loading. Prevent layout shift when data arrives.
- [ ] T107: **Empty state illustration**. When a folder is empty, show a friendly empty-state message with illustration (e.g., "This folder is empty. Drop files here or create a new folder.").
- [ ] T108: **Mobile-responsive toolbar**. On small screens, collapse workspace bar actions into a `...` menu. Hide sidebar. Make file rows touch-friendly with larger tap targets.

---

## Phase 19: Code Quality & Architecture

- [ ] T109: **Extract render package**. Move `RenderTemplate` and template caching to `internal/render/render.go`. Parse once at startup. Thread-safe template map.
- [ ] T110: **Event delegation**. Remove all `onclick`/`onsubmit` from templates. Register all event listeners in app.js with `addEventListener`. Eliminates XSS surface.
- [ ] T111: **Remove dead code**. Delete unused `SetCookie`/`ClearCookie` in `session.go`. Delete `QL_THEME` config field. Remove unused imports.
- [ ] T112: **Integration tests for all API endpoints**. Test `/browse`, `/api/folder/create`, `/api/delete`, `/api/rename`, `/api/upload`, `/api/download`, `/login`, `/logout` with authenticated and unauthenticated requests. Cover path traversal, invalid names, missing fields, wrong methods, CSRF checks.
- [ ] T113: **Makefile**. `make dev`, `make build`, `make test`, `make css`, `make docker`, `make lint`, `make clean`.
- [ ] T114: **Add error logging and request IDs**. Generate a UUID per request. Log request ID, method, path, status, duration, and errors. Include request ID in error responses for debugging.

---

## Phase 20: Sharing & Multi-User (v2 scope — stretch goals)

- [ ] T115: **Public share links**. `POST /api/share {path, expiresAt, password?}` generates a unique URL that lets non-authenticated users access a file/folder. `GET /s/{token}` serves the shared resource. Store shares in `.nodishare.json`.
- [ ] T116: **Share expiry and revocation**. Shares auto-expire at configured time. Owner can revoke at any time. One-time download links.
- [ ] T117: **Read-only vs upload-only share modes**. Share links can be: read-only (download only), upload-only (drop files only), or read-write. Enforce on server.
- [ ] T118: **Activity log**. `GET /api/activity` returns recent operations (uploads, deletes, renames, logins). Store in `.nodilog.jsonl` (append-only). Show in admin panel.
- [ ] T119: **Storage usage dashboard**. Compute disk usage by scanning QL_ROOT. Show total used, total available, breakdown by type (images, videos, documents, other). Show in TopBar storage bar (currently a placeholder).
- [ ] T120: **Admin settings UI**. `/settings` page to change password, view active sessions, manage shares, configure upload limits. All reads/writes to `.nodisettings.json` in QL_ROOT.
- [ ] T120b: **Full backup download**. Add "Download Backup" button in settings page. `GET /api/backup` streams the entire `QL_ROOT` directory as a ZIP file. Show progress bar. Add warning modal: "This will create a ZIP of all your files. Large directories may take time." Include option to exclude `.trash/` and `.cache/` from backup.
- [ ] T120c: **Backup restore from upload**. Add "Restore Backup" button in settings page. `POST /api/restore` accepts a ZIP upload, extracts to a temporary directory, validates contents, then merges into `QL_ROOT` (skip existing or overwrite — user choice). Show confirmation modal with file count before proceeding.

---

## Phase 20b: Professional Documentation & Landing Page

- [ ] T121: **Create `docs/` directory with full documentation site**. Create a `docs/` folder with the following Markdown files:
  - `docs/index.md` — Documentation home: quick start, architecture overview, links to all sections
  - `docs/installation.md` — Install methods (Docker, binary, source), system requirements, environment variables table with all `QL_*` vars, defaults, and descriptions. Docker Compose example. Reverse proxy setup (nginx, Caddy, Traefik) with real configs.
  - `docs/configuration.md` — Every config option documented with type, default, and example. `QL_ROOT`, `QL_PORT`, `QL_USER`, `QL_PASS_HASH` (how to generate bcrypt), `QL_COOKIE_SECRET`, `QL_MAX_UPLOAD`, `QL_SESSION_EXPIRY`, `QL_TRUSTED_PROXY`. Security hardening tips.
  - `docs/api.md` — Full API reference: every endpoint, method, request body, response body, status codes, error codes, authentication requirements, CSRF requirements, curl examples. Organized by resource (auth, files, folders, upload, download, system).
  - `docs/security.md` — Auth flow diagram, cookie security, CSRF protection, path traversal prevention, rate limiting, recommended nginx/Caddy hardening, TLS setup, reverse proxy headers.
  - `docs/contributing.md` — Dev setup, code style, PR process, testing requirements, branch naming, commit conventions.
  - `docs/changelog.md` — Version history following Keep a Changelog format.
- [ ] T122: **Add docs to landing page**. Add a "Documentation" link in the landing page header/navigation. Create a `/docs` section on the landing page (or link to GitHub docs) with: Getting Started, Installation, Configuration, API Reference, Security, and Contributing. Make it look professional with a clean layout, search bar (even if static), and syntax-highlighted code blocks.
- [ ] T123: **Add interactive API docs**. Serve Swagger UI at `/api/docs` endpoint. Document all endpoints with request/response schemas, parameters, authentication requirements, and curl examples. Auto-generate from Go handler comments (swaggo/swag) or write a static `docs/api.yaml` OpenAPI spec.
- [ ] T124: **Add real screenshots to landing page and README**. Capture actual screenshots of: login page, dashboard list view, dashboard grid view, file context menu, upload progress, theme toggle, mobile view. Add to README and landing page. Replace the CSS mockup illustrations with real app screenshots. Add an animated GIF demo of file operations.
- [ ] T125: **Add architecture diagram**. Create a Mermaid diagram in docs and README showing: User → Browser → Go Server (templates + API) → Filesystem. Show auth flow (login → session cookie → middleware). Show static asset pipeline (Tailwind → output.css). Make it easy for new developers to understand the stack.
- [ ] T126: **Overhaul README.md**. Add: real app screenshots, configuration table with all env vars, quick start section (Docker one-liner, manual install), architecture overview, API reference link, security section, license, version badge, live demo link. Remove outdated references to "Node"/"quantum-lite". Add table of contents.
- [ ] T127: **Fix landing page issues**. Replace `og:image` SVG with PNG/JPEG (Twitter/LinkedIn/Slack don't render SVG). Add favicon. Remove the decorative "94%/88%" performance bars — they're not real benchmarks and look misleading. Add link to documentation. Add real app screenshots instead of CSS mockups. Add "View Documentation" CTA button.
- [ ] T128: **Add CHANGELOG.md**. Initialize with v0.1.0. Follow Keep a Changelog format with Added, Changed, Fixed, Security, Deprecated, Removed sections. Link to GitHub releases.
- [ ] T129: **Add SECURITY.md**. Vulnerability reporting policy: how to report (email or GitHub Security Advisory), response SLA (48h acknowledgment, 7-day fix for critical), supported versions, security contact. Required for any project accepting public contributions.

---

## Phase 21: Repository & Project Setup (must fix before any release)

- [x] T130: **Add LICENSE file**. Create `LICENSE` with MIT license text. README and landing page claim MIT but no LICENSE file exists — the repo has no legal license. Without it, default copyright applies (all rights reserved).
- [x] T131: **Fix go.mod module path**. Change `module nodi` to `module github.com/Twarga/Nodi`. Fix all import paths accordingly. The current bare `nodi` path breaks `go install` and `go get` for external consumers.
- [x] T132: **Fix go.mod Go version**. Change `go 1.26.2` to `go 1.24` (or whatever stable version is current). Go 1.26 does not exist as a stable release — this breaks `go mod tidy` and all downstream tooling.
- [x] T133: **Fix Dockerfile base images**. Replace `golang:1.26-alpine` with `golang:1.24-alpine` and `alpine:3.22` with `alpine:3.21`. Current base images don't exist — Docker build WILL FAIL.
- [x] T134: **Update plan.md**. Rename all references from "Node"/"quantum-lite" to "Nodi". Remove outdated technical decisions. Bring it in line with the current codebase and TASKS.md.
- [x] T135: **Remove `front-end inspiration/` from git**. Add `front-end inspiration/` to `.gitignore`. This directory has 95 tracked source files with a space in the name, bloating the repo. It's a React/Vite reference project — not part of Nodi's runtime. Keep it locally but don't track it.
- [x] T136: **Delete `web/templates/test.html`**. Leftover test file with broken CSS classes. Serves no purpose.
- [x] T137: **Add `.editorconfig`**. Consistent indentation (Go: tabs, JS/HTML/CSS: 2 spaces), trailing newlines, UTF-8, no trailing whitespace. Ensures consistency across contributors.
- [x] T138: **Optimize `logo.png`**. Currently 1.4MB tracked in git. Compress to webP/PNG and reduce to <100KB, or convert to SVG. Consider git-lfs for large assets.

---

## Phase 22: CI/CD & Automation

- [x] T139: **Add Go CI workflow**. Create `.github/workflows/go-ci.yml` that runs on push/PR to main: `go vet`, `go test ./...`, `golangci-lint run`. Must pass before Docker publish. Currently no CI at all — code is pushed without testing.
- [x] T140: **Fix docker-publish.yml**. Update base images (T133). Add `test` step before build. Add multi-arch build (`linux/amd64`, `linux/arm64`). Add vulnerability scanning with trivy.
- [x] T141: **Add release workflow**. Create `.github/workflows/release.yml` that triggers on GitHub release. Builds binaries for linux/amd64, linux/arm64, darwin/amd64, darwin/arm64. Uploads artifacts. Updates Docker image tag. Generates CHANGELOG entry.
- [x] T142: **Add Dependabot config**. Create `.github/dependabot.yml` for Go modules and Docker base images. Auto-create PRs for security updates and version bumps.
- [x] T143: **Add issue and PR templates**. Create `.github/ISSUE_TEMPLATE/bug_report.yml`, `.github/ISSUE_TEMPLATE/feature_request.yml`, `.github/PULL_REQUEST_TEMPLATE.md`. Standardize contributions.
- [x] T144: **Add branch protection rules docs**. Document required branch protection: require PR reviews, require CI pass, require up-to-date branch. Add to contributing docs.

---

## Phase 23: Build System & Developer Experience

- [x] T145: **Create Makefile**. Targets: `make build` (compile binary with version ldflags), `make run` (build + run), `make dev` (air/watch for hot-reload), `make test` (go test), `make lint` (golangci-lint), `make css` (tailwind compile), `make css-watch` (tailwind watch), `make docker` (build image), `make clean` (remove binaries, tailwind binary, .cache).
- [x] T146: **Improve run.sh**. Replace platform-specific Tailwind binary download with `npm install -D tailwindcss` or use Makefile. Add `--watch` flag for CSS hot-reload. Add `--help` flag. Support macOS (darwin-arm64, darwin-amd64) in addition to linux. Verify checksums of downloaded binaries.
- [x] T147: **Improve install.sh**. Don't print the default password in cleartext. Add `--dry-run` option. Add `--uninstall` option. Verify Docker is running before starting. Add `--update` option to pull the latest image and restart. Add health check timeout.
- [x] T148: **Improve docker-compose.yml**. Add resource limits (`mem_limit`, `cpus`). Add logging configuration (`max-size`, `max-file`). Add `depends_on` with health condition if future services are added. Document all environment variables in comments.
- [x] T149: **Update .env.example**. Document `QL_SESSION_EXPIRY` (currently hardcoded to 24h). Document `QL_TRUSTED_PROXY` (planned in T66). Generate a proper random cookie secret by default instead of `local-development-secret-keep-it-safe-123`. Add comments explaining each variable's format and valid ranges.
- [x] T150: **Add dev container / Docker Compose override**. Create `docker-compose.override.yml` for development with volume mounts for hot-reload, Tailwind watch mode, and Air for Go hot-reload. Separate from production compose.

---

## Phase 24: Monitoring, Health & Operations

- [x] T151: **Add `/api/health` endpoint**. Returns `{"status":"ok","version":"0.1.0","uptime":"2h30m"}`. Used by Docker healthcheck, load balancers, and monitoring. Replace current Docker HEALTHCHECK with a curl to this endpoint.
- [x] T152: **Add `/api/version` endpoint**. Returns `{"version":"0.1.0","go_version":"1.24","build_time":"2026-05-02T12:00:00Z"}`. Useful for debugging and automated updates.
- [x] T153: **Add request logging with request IDs**. Generate UUID per request. Log method, path, status, duration, request ID. Include request ID in 500 error responses for debugging. Store in request context for downstream handlers.
- [x] T154: **Add metrics endpoint** (optional). `GET /api/metrics` returns JSON with: total requests, active uploads, storage used, uptime. Useful for monitoring dashboards (Grafana, Prometheus scrape format could be added later).
- [x] T155: **Add graceful shutdown**. On SIGINT/SIGTERM: stop accepting new connections, finish in-flight requests (with timeout), close database/file handles cleanly, log shutdown. Don't just `log.Fatal(http.ListenAndServe(...))`.
- [x] T156: **Add startup self-check**. On boot, verify: QL_ROOT exists and is writable, QL_COOKIE_SECRET is ≥32 bytes, QL_PORT is valid, templates parse correctly, static assets directory exists. Fail fast with clear error messages before accepting connections.

---

## Summary of All Missing Items (Why It's Not Production-Ready)

### Hard blockers (cannot ship without these):
1. **No CSRF protection** — any site can perform actions as the logged-in user
2. **XSS via filenames** — crafted filenames execute arbitrary JS
3. **No LICENSE file** — repo has no legal license despite claiming MIT
4. **Docker build is broken** — base images `golang:1.26-alpine` and `alpine:3.22` don't exist
5. **go.mod version is wrong** — `go 1.26.2` doesn't exist, breaks all tooling
6. **No Go CI** — code is pushed to main without any automated testing
7. **No file preview** — clicking a file just downloads it
8. **No search** — no way to find files
9. **No sorting** — only alphabetical, folders-first
10. **No copy/move** — can't move files between folders
11. **No archive support** — can't zip or unzip anything
12. **No trash** — delete is permanent and irreversible
13. **No directory download** — can't download a folder
14. **No pagination** — large directories crash the browser
15. **No backup/restore** — can't download all files as ZIP or restore from backup

### What makes it feel amateur:
- No documentation site — no install guide, no API reference, no security docs
- No real screenshots — landing page and README show no actual app images
- No image thumbnails in grid view
- No keyboard shortcuts
- No loading states or skeletons
- No empty state UI
- Broken SVG icons (missing icons render as blanks)
- Hardcoded version number
- Dead/duplicate code in app.js
- Silent file overwrite on upload
- Overly restrictive filename validation
- No config validation on startup
- Templates parsed on every request
- No Makefile
- No CHANGELOG
- No .editorconfig
- No CI pipeline
- `front-end inspiration/` tracked in git with 95 files
- `plan.md` calls project "Node"/"quantum-lite"

### What real file managers have that Nodi doesn't:
- Folder tree sidebar navigation
- Right-click context menus
- Recent files view
- Favorites/bookmarks
- Inline text/code editor
- Resumable/chunked uploads
- Folder upload
- Share links with expiry and permissions
- Activity/audit log
- Storage usage dashboard
- Admin settings UI with backup/restore
- Health and version endpoints
- Professional API documentation
- Proper CI/CD pipeline
- Release workflow with versioning
- Documentation site linked from landing page