# Nodi Task Breakdown

## Phase 0: Repository & Environment Setup
- [x] T1: Initialize Git and initial project files (`plan.md`, `README.md`).
- [x] T2: Connect GitHub remote (`Twarga/Nodi`), create `main` branch, and push.
- [x] T3: Initialize Go module (`go mod init nodi` or `quantum-lite`).
- [x] T4: Scaffold project structure (`cmd/server`, `internal/`, `web/`).
- [x] T5: Setup Tailwind CSS build pipeline. Create `web/static/input.css` copying design tokens (HSL variables) from React reference.
- [x] T6: Create generic `Makefile` or setup instructions for Tailwind build + Go run.

## Phase 1: Core Backend & Auth (Go)
- [x] T7: Implement environment configuration loader (`internal/config`). Read `QL_USER`, `QL_PASS_HASH`, `QL_ROOT`, `QL_PORT`, `QL_MAX_UPLOAD`, `QL_COOKIE_SECRET`, `QL_THEME`.
- [x] T8: Create `cmd/server/main.go` setting up `http.ServeMux` and loading env configs.
- [x] T9: Implement logging middleware and request tracking.
- [x] T10: Implement `internal/auth/session.go` for secure cookie generation (HMAC signed) and validation.
- [x] T11: Implement `/login` POST endpoint matching bcrypt hashed password.
- [x] T12: Implement Rate Limiting middleware for login attempts (5 IP requests / 15m).
- [x] T13: Implement generic auth middleware to protect `/browse`, `/upload`, etc. endpoints.

## Phase 2: Frontend Layout & Auth Views (Vanilla/Tailwind)
- [x] T14: Create `web/templates/layout.html` with basic layout, `<head>` config, and initial global styling.
- [x] T15: Create `web/templates/login.html` mimicking React `Login.tsx` style (card, centered, input styles).
- [x] T16: Wire `/login` handler to render `login.html` via `html/template`.
- [x] T17: Port SVG sprites from `icons.svg` or inline SVG based on React `FileIcon.tsx` shapes.
- [x] T18: Implement theme toggling logic using vanilla JS (Dark/Light/System) matching inspiration `ThemeProvider`. Store in `localStorage`.

## Phase 3: Dashboard Layout & File Reading
- [x] T19: Implement TopBar layout (`TopBar.tsx` equivalent) featuring "Nodi" logo and user pill in `dashboard.html`.
- [x] T20: Implement Breadcrumbs (`Breadcrumbs.tsx` equivalent) component structure. 
- [x] T21: Construct `internal/handlers/files.go` with safe path resolution logic (chroot to `QL_ROOT`).
- [x] T22: Implement `GET /browse` to read directories using `os.Stat` and `readdir`. Transform into `.json` or `.html` block.
- [x] T23: Render Main Dashboard view (`FileList.tsx` and `FileGrid.tsx` equivalents) with toggle styles.

## Phase 4: Core File Actions (Go & Vanilla JS)
- [x] T24: Create context menus (Action Dropdown) for files using Vanilla JS dialogs or absolute layouts.
- [x] T25: Implement Create Folder (`/api/folder/create`) passing `os.Mkdir` securely.
- [x] T26: Implement Delete File/Folder (`/api/delete`) with `os.RemoveAll`.
- [x] T27: Implement Rename (`/api/rename`) with `os.Rename`.
- [x] T28: Wire Create Folder Modal in `dashboard.html` (`Modal.tsx` equivalent).
- [x] T29: Wire Rename Modal taking prior state/filename.
- [x] T30: Wire Delete confirmation Modal.
- [x] T31: Add JS `fetch()` logic for actions to asynchronously update without reloading page. Add Toast Notifications (`sonner` aesthetic).

## Phase 5: File Upload System
- [x] T32: Implement Drag-and-drop overlay in Vanilla JS (`DropOverlay.tsx` equivalent).
- [x] T33: Implement File Upload Backend (`/api/upload`) using `io.Copy` and `multipart/form-data`.
- [x] T34: Set up temporal `/tmp/ql-upload-` directory cleanup mechanics and atomic rename to final destination.
- [x] T35: Render Upload List (`UploadList.tsx` equivalent) progress UI beneath breadcrumbs updating via JS streams/polling.

## Phase 6: Packaging & Docker
- [x] T36: Build Dockerfile via Multi-Stage build (Node/Alpine for Tailwind -> Go Alpine for compilation -> Run Alpine container).
- [x] T37: Expose config properly using default `.env` examples.
- [x] T38: Create `docker-compose.yml` demonstrating full volume mounts and secure variables.

## Phase 7: GitHub Pages Landing Page
- [x] T39: Create `landing-page/` directory.
- [x] T40: Scaffold an index.html minimal beautiful landing page advertising Nodi, linking back to GitHub Repo. No dynamic backend, statically deployed.
- [x] T41: Set up simple GitHub Action workflow to build/push `landing-page/` to `gh-pages` branch.
 
## Phase 8: Deployment Polish
- [x] T42: Create `install.sh` robust installer (dependency checks, auto-config, directory setup).
- [x] T43: Overhaul `README.md` with minimalist "Claude-style" documentation.
- [x] T44: Create `run.sh` convenience script for local development and testing.

## Phase 9: MVP Repair & Release Hardening
- [x] T45: Fix runtime routing and dashboard rendering. Serve `/static/` assets, load all dashboard component templates, and make authenticated `/` return the app shell instead of `500`.
- [x] T46: Harden file path confinement. Replace prefix-based path checks, reject root escapes, protect against symlink traversal, and add regression tests.
- [x] T47: Complete file API behavior. Implement secure downloads, return stable JSON arrays from `/browse`, enforce `QL_MAX_UPLOAD`, and add endpoint tests.
- [x] T48: Harden auth and HTTP security controls. Fix login rate-limit identity, add production-safe cookie/security headers, and test the behavior.
- [x] T49: Repair frontend file-manager workflows. Remove unsafe file-name HTML injection, wire upload/delete/download/view toggles, and keep SPA navigation stable.
- [x] T50: Fix installation and packaging. Align Go/Docker versions, replace invalid default hashes, remove committed binary drift, and verify local/Docker startup docs.
- [x] T51: Add end-to-end quality gates. Cover login, dashboard, static assets, browse, create, rename, delete, upload, download, traversal rejection, and symlink rejection.
