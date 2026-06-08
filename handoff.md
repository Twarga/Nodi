# Nodi Remake Handoff

This is the continuation brief for another AI model or engineer. The objective is to finish the Nodi remake into a real, releasable home-network file hub with large-file reliability, easy mobile/desktop use, safe sharing, Docker/GitHub image publishing, and Kubernetes deployment support.

Current date when this handoff was created: 2026-06-04.

Repository root: `/home/twarga/Documents/Nodi`

Primary planning file: `tasks.md`

## 1. Product Goal

Nodi is being remade from a basic self-hosted file manager into a practical home-network Google Drive/AirDrop-style file hub.

The required product promise:

- A user opens Nodi from any phone, laptop, tablet, or desktop on their home network.
- They can drag files or folders into the browser.
- Very large files, including 20GB-100GB files, upload reliably.
- Uploads stream to disk, resume after refresh/network loss, and never leave corrupt final files.
- Mobile upload is first-class, with camera/gallery/file picker flows.
- Files are browsable, searchable, previewable, downloadable, shareable, restorable, and mountable through WebDAV.
- The app is not a prototype or demo. It must be structured enough to release.
- The app must be packaged as a real image on GitHub Container Registry and deployable through Kubernetes.

Design direction:

- Google Drive convenience.
- AirDrop simplicity.
- Homelab reliability.
- Avoid Nextcloud-style bloat. Do not add collaboration/groupware/media-server scope unless explicitly required.

## 2. Current State Summary

The remake is significantly progressed, but not finished.

Core large-file upload foundation is mostly complete:

- Normal multipart upload streams through `MultipartReader`.
- `ParseMultipartForm` is no longer used for normal upload paths.
- Resumable chunks are server-issued and stored under `.cache/uploads/<uploadId>/`.
- Upload sessions have metadata, status, cancel, cleanup, chunk limits, TTL, and generated-stream tests.
- Chunk assembly writes to a temp file in destination directory, then atomically renames.
- Tests cover generated large-stream upload, chunk assembly, chunk resume, and incomplete final file prevention.
- Frontend upload session state persists in localStorage.
- Frontend retries chunks with exponential backoff and status reconciliation after network failures.
- Upload queue supports pause, resume, cancel, retry, speed, ETA, duplicate conflict policy, folder upload, and drag/drop folder traversal.

Major product areas already implemented:

- Navigation structure: Home, Files, Send, Share, Devices, Settings.
- Persistent upload panel.
- File manager bulk actions: download, move, copy, delete, share, compress.
- Streamed archive downloads for selected files.
- Search across storage root with filters.
- Previews: image, video, audio, PDF, text/code.
- Safe inline text editing for small text files.
- File hash calculation on demand.
- Metadata sidebar.
- Sharing: read-only file/folder links, passwords via POST/cookie, public upload dropboxes, template escaping, hashed share tokens.
- Cross-device: QR/LAN URLs, PWA assets, WebDAV endpoint, platform setup guidance, optional Caddy compose.
- Trash: UUID trash entries, metadata, list, restore, permanent delete, empty trash, retention cleanup.
- Health page: disk free, active/abandoned uploads, version, uptime, trash counts.
- Installer safety: generated cookie secret, rejection of unsafe cookie secret defaults, one-time admin password generation.
- Backup: default backup export is now streaming TAR, with legacy ZIP available via `?format=zip`; restore supports TAR and ZIP.

Recent verification passed:

- `GOCACHE=/tmp/nodi-gocache go test ./...`
- `npm run build` from `web/app`

Important: passing tests are not enough to call the remake complete. Real-device release gates in `tasks.md` remain unchecked.

Two confirmed UX bugs were fixed in the current session and the fixes are part of the green test/build status above:

- `web/app/src/components/UploadPanel.tsx` "clear" button used to call `clearUploads()` from `web/app/src/hooks/useUpload.ts:202`, which cancels in-flight uploads. The button now calls `clearCompleted()`, a new helper that only removes items in `done` / `skipped` / `error` states. Active uploads keep running. The icon is disabled when there is nothing finished to clear. A separate explicit "Cancel all" action can still call `clearUploads()` if needed.
- Share expiry inputs sent `<input type="datetime-local">` values like `2026-12-25T15:30` directly to the backend. The backend's `time.RFC3339` parser at `internal/handlers/shares.go:595` rejected them silently, so expiring links never expired. The frontend now converts via `datetimeLocalToRFC3339()` in `web/app/src/lib/utils.ts` (used in `web/app/src/pages/Share.tsx` and `web/app/src/components/ShareModal.tsx`). The backend is also defensive now — `parseShareExpiry` in `internal/handlers/shares.go` accepts RFC3339, RFC3339Nano, and naive datetime variants.

The frontend design system was also established this session: `web/app/src/index.css` defines editorial primitives (`.display-1`, `.display-2`, `.eyebrow`, `.lede`, `.hr`, `.btn-*`, `.input`, `.nav-link`, `.icon-button`) and a full `.dark` mode. Decorative gradients and the `bg-card`/`shadow-*` chrome have been removed from non-card surfaces. The visual re-skin is in place across all pages and the major components, but **the rework has not yet passed the §4.2 acceptance gates** — see §4 for the honest state.

## 3. Worktree State

The worktree is dirty and contains many modified/untracked files from the remake. Do not assume clean git state. Do not revert unrelated changes.

Known modified/high-impact files include:

- `.env.example`
- `Dockerfile`
- `README.md`
- `cmd/server/main.go`
- `docker-compose.yml`
- `install.sh`
- `run.sh`
- `internal/config/env.go`
- `internal/handlers/backup.go`
- `internal/handlers/files.go`
- `internal/handlers/shares.go` (added `parseShareExpiry` defensive parser)
- `internal/handlers/stats.go`
- `internal/handlers/upload_test.go`
- many frontend files under `web/app/src` (rewritten: `index.css`, all pages, ~20 components, `lib/utils.ts`, `hooks/useUpload.ts` — see §4.3)
- generated frontend assets under `web/static/dist`

Known untracked/high-impact files include:

- `tasks.md`
- `remake2.md`
- `handoff.md`
- `Caddyfile.example`
- `docker-compose.caddy.yml`
- `internal/config/env_test.go`
- `internal/handlers/backup_test.go`
- `internal/handlers/devices.go`
- `internal/handlers/devices_test.go`
- `internal/handlers/edit_test.go`
- `internal/handlers/hash_test.go`
- `internal/handlers/health_test.go`
- `internal/handlers/search_test.go`
- `internal/handlers/shares_test.go`
- `internal/handlers/shares_expiry_test.go` (new — covers `parseShareExpiry` formats)
- `internal/handlers/webdav.go`
- `internal/handlers/webdav_test.go`
- PWA files and icons under `web/app/public` and `web/static/dist`
- new frontend pages/components: `Home.tsx`, `Send.tsx`, `Share.tsx`, `Devices.tsx`, `MetadataSidebar.tsx`, `SearchFilters.tsx`

Rules for the next model:

- Do not run destructive git commands.
- Do not revert files unless explicitly requested.
- Preserve generated `web/static/dist` changes when frontend build runs.
- Use `apply_patch` for manual edits.
- Run `gofmt` after Go edits.
- Run `npm run build` after frontend edits.
- Run Go tests with `GOCACHE=/tmp/nodi-gocache go test ./...`.
- If Go tests fail because `httptest` cannot bind localhost due sandbox restrictions, rerun with escalation/approval if available.

## 4. Frontend Remake Acceptance (Release Gate)

The frontend was visually reworked in this remake but the rework has **not** passed acceptance yet. Treating it as "done" is a known mistake from the previous handoff. Do not check frontend P0 in `tasks.md` until every item below is satisfied with evidence.

### 4.1 Design Discipline (Non-Negotiable)

The design is a hard-rule no-card system, modeled on Editorial / Linear / Vercel marketing pages. The rules are enforced both visually and in code. If a screenshot or `git diff` shows otherwise, the work is not done.

- **No cards in hero, sections, or page containers.** Cards exist only where they are real user interactions: forms, modals, repeated items in a list.
- **Full-bleed sections.** Each page section extends to the viewport edge. Never wrap the page in a card, panel, rounded box, or background fill that does not also cover the surrounding canvas.
- **Columns, whitespace, hairline dividers, lists, media blocks** are the only structural primitives. No nested cards. No card-inside-card.
- **One composition per viewport.** Each route resolves to a single editorial composition. No 2-column card grids, no SaaS-style feature grids.
- **Hero is full-bleed** with a single dominant visual (image, type block, or product shot). No inset hero, no split-card hero, no rounded hero with internal padding.
- **No decorative gradients.** No SaaS-style 3-up "features" cards. No rounded media cards. No shadow stacks.
- **Type-driven hierarchy.** Editorial display sizes (clamp-driven) and eyebrow/lede utilities carry the rhythm. Body copy is calm; one accent color at most.
- **Repeated items (file rows, share rows, devices, history)** may use list/grid layouts with hairline separators, but the cells themselves must not have border + radius + shadow chrome. They are media blocks, not cards.

If any of the above is violated by a new or modified component, fix it before merging. Do not "ship and polish later."

### 4.2 Acceptance Gates (must all pass before checking frontend P0)

- [ ] **No-card audit**: every page (`/`, `/files`, `/send`, `/share`, `/devices`, `/settings`, `/login`) screenshots reviewed on desktop, tablet, mobile. No card chrome on hero/sections/page containers. Forms and modals may be card surfaces.
- [ ] **Mobile-first**: every page usable on a 375px viewport without horizontal scroll. Touch targets ≥ 44px. No card grids that collapse to a single column with leftover card chrome.
- [ ] **Dark mode parity**: every page renders correctly in `.dark` with hairline borders still visible and adequate contrast.
- [ ] **Real-device drag/drop**: drop a 1GB file from a desktop browser and a 200MB file from a phone browser. Progress is visible in `UploadPanel.tsx` for the entire duration.
- [ ] **Mobile upload warning**: long-running mobile uploads surface a keep-awake / browser-open warning, not just a `pending` indicator.
- [ ] **Empty states and error states** are not card chrome. They are centered type + a single action, on the page background.
- [ ] **No `rounded-2xl` / `rounded-3xl` / `shadow-*` / `bg-card` on non-card surfaces** (grep clean).
- [ ] **Routing audit**: every route declared in `web/app/src/App.tsx` resolves to the new editorial page. Verified routes: `home` → `HomePage`, `files` → `DashboardPage` (which is the new file manager under `web/app/src/pages/Dashboard.tsx` — uses TopBar, FileList, FileGrid, SelectionBar, MetadataSidebar, ShareModal, etc.), `send` → `SendPage`, `share` → `SharePage`, `devices` → `DevicesPage`, `settings` → `SettingsPage`, `login` → `LoginPage`. **Optional clarity refactor**: rename `web/app/src/pages/Dashboard.tsx` → `Files.tsx` and update `web/app/src/App.tsx:5` to `import { FilesPage } from './pages/Files'` and `App.tsx:47` to `<FilesPage />`. Not a blocker — the route already serves the new design.
- [ ] **Accessibility**: focus rings are visible; keyboard navigation works end-to-end on every page; `aria-label` on icon-only buttons.
- [ ] **Performance**: `npm run build` produces a single CSS bundle ≤ 50 kB and a single JS bundle ≤ 250 kB, both gzipped; first contentful paint on `localStorage`-cold reload ≤ 1.5s on a recent phone.
- [ ] **No UX regression**: the two bugs fixed in the current session must not reappear:
  - `UploadPanel` "clear" button must never cancel active uploads. It removes only done/skipped/error items via `clearCompleted()` in `web/app/src/hooks/useUpload.ts`. Active uploads get a separate "Cancel all" action with a confirm step.
  - Share expiry inputs (`<input type="datetime-local">`) must be converted to RFC3339 via `datetimeLocalToRFC3339()` in `web/app/src/lib/utils.ts` before being sent to the backend. The backend's `parseShareExpiry` in `internal/handlers/shares.go` is defensive and accepts multiple formats, but the frontend is the source of truth.

### 4.3 What "Frontend P0" Currently Looks Like (honest state)

- The visual design system and primitives exist in `web/app/src/index.css` (`.display-1/.display-2/.eyebrow/.lede/.hr/.btn*/.input/.nav-link/.icon-button`, full `.dark` mode). Decorative gradients removed.
- The pages `Home.tsx`, `Send.tsx`, `Dashboard.tsx`, `Share.tsx`, `Devices.tsx`, `Settings.tsx`, `Login.tsx` have all been rewritten to the new system. Components under `web/app/src/components/` (TopBar, UploadPanel, MetadataSidebar, FileList/Grid/Row, modals, context menu, lightbox, media player, share modal, folder picker, etc.) have been rebuilt.
- `npm run build` is green; `go test ./...` is green.
- **Not yet done**: mobile-first validation on a real device; the no-card audit pass; focus/keyboard review; the optional `Dashboard.tsx` → `Files.tsx` rename refactor (not a blocker).

Do not mark frontend P0 complete from "the build compiles." Run the gates in §4.2.

### 4.4 Open items in `tasks.md` that the handoff references but does not duplicate

`tasks.md` is the source of truth. The handoff does not re-check every box; it tracks the structural overlay. These specific items are still open and are referenced from the acceptance gates above so progress on the handoff and on `tasks.md` stays in sync:

- `tasks.md:83` — "keep screen awake" helper for long mobile uploads (Wake Lock). Covered by §4.2 mobile upload warning gate and §6.2.
- `tasks.md:84` — mobile warning when browser/background sleep may pause upload. Covered by §4.2 mobile upload warning gate and §6.2.
- `tasks.md:99` — responsive mobile layout for all primary flows. Covered by §4.2 mobile-first gate.
- `tasks.md:123` — server-side pagination or virtualized browsing for huge folders. Covered by §6.3 and §13 medium risk.
- `tasks.md:274+` — Phase 10 real-device release gates (20GB / 100GB / network interruption / 10k folder / WebDAV mount / etc.). Not part of frontend acceptance; covered by §8 Verification Requirements and §12 Completion Definition.

## 5. Current Completed Checklist Snapshot

The authoritative checklist is `tasks.md`. Use that file as the source of truth.

Major completed checklist groups:

- Phase 0 P0 large-file foundation is complete except disk-space/integrity P1 work.
- Phase 1 P0 upload UX is complete.
- Phase 2 core structure is complete.
- Phase 3 core bulk file manager actions are complete.
- Phase 4 search/preview is complete.
- Phase 5 core sharing and share-token safety are mostly complete.
- Phase 6 core cross-device access is complete.
- Phase 7 installer/auth safety items are partly complete.
- Phase 8 trash, backup, health are partly complete.
- Phase 9 Docker/compose/env/README/Caddy basics are partly complete.

The top-level `Non-Negotiables` in `tasks.md` are intentionally still unchecked. They are broad release-wide invariants and require final audit plus real-device release gates before checking. Frontend P0 is **not** in the completed list — see §4 for the honest state and §4.2 for the release-gate criteria that must be checked first.

## 6. Highest Priority Remaining Work

The remaining work should be handled in this order.

### 6.1 Disk Safety For Large Uploads

Implement:

- Disk-space preflight before starting known-size uploads.
- Clear disk-full errors.
- Safe cleanup when disk fills mid-upload.
- Optional upload integrity verification using SHA-256 after completion.

Suggested backend path:

- Add storage-free-space helper, probably using `syscall.Statfs` like `internal/handlers/stats.go`.
- In `UploadStart`, reject known-size uploads when free space is too low.
- Consider available space in destination filesystem, not just root path if mounted differently.
- For normal multipart upload, detect `ENOSPC` during `io.Copy`/`Close`/`Rename` and return clear per-file error.
- For chunk upload, detect write failures and ensure temp chunk is removed.
- Add tests for mocked or temp-path free-space logic where possible. Actual disk-full simulation may need integration/manual testing.

Suggested frontend path:

- Show human message: “Not enough disk space on Nodi storage.”
- Do not leave upload stuck as generic `HTTP 500`.

### 6.2 Release-Quality Mobile Upload

Now implemented in code:

- Wake Lock request while uploads are active where the browser supports it.
- Visible browser/background sleep warning through the upload state layer.
- Upload queue grouping by folder path.
- Transfer history with completed/skipped/failed/canceled states.

Suggested files:

- `web/app/src/pages/Send.tsx`
- `web/app/src/components/UploadPanel.tsx`
- `web/app/src/hooks/useUpload.ts`
- `web/app/src/lib/api.ts`

Acceptance:

- Phone browser flow should be understandable without reading docs.
- Long mobile uploads should warn about keeping the browser open.
- Upload panel should not feel like a developer log.

### 6.3 File Manager Polish

Remaining important tasks:

- New folder/new file flows with consistent validation.
- Breadcrumb path copy.
- Favorites or pinned folders.
- Recursive recent files excluding app metadata.
- Fast sorting by name, size, type, modified date.
- Huge folder pagination or virtualization.
- Stable thumbnail cache keys based on path/hash.
- Thumbnail cache size limit and cleanup.

Risk:

- Huge folders can kill UX if everything is rendered at once.
- Thumbnail cache collisions still appear in the task list as unresolved.

### 6.4 Sharing Completion

Remaining:

- Share dashboard tabs: active, expired, revoked, dropboxes. Current UI now has active/expired/dropboxes/all, but not revoked retention.
- Share download limits.
- QR code for each share.
- Optional one-time/send-once links.

Implemented in the current remake state:

- Expiring links.
- Dropbox max file size and max file count.
- Share activity events (`share.unlock`, `share.open`, `share.list`, `share.download`, `share.upload`).
- Share owner/created-by metadata.

Important existing behavior:

- Passwords are no longer in URLs.
- Unlock uses POST and cookie.
- Share HTML uses `html/template`.
- New share tokens are hashed in `.nodishare.json`.
- For hashed-token shares, raw public link cannot be reconstructed later. UI should explain link is shown only at creation.

### 6.5 Accounts And Safety

This is a large remaining area.

Tasks:

- Add users file under app metadata.
- Support admin and regular users.
- Scope regular users to home directories.
- Add admin UI for creating users and resetting passwords.
- Add per-user quota.
- Enforce quota before and during upload.
- Add per-user activity log filtering.
- Change logout to revoke only current session.
- Add sign out everywhere.
- Revoke sessions after password change.
- Add WebDAV app passwords or per-user credentials.
- Add login lockout/recovery guidance.
- Add audit log entries for login/logout/password/share/delete.

Risk:

- Current app is still basically single-user admin-centered.
- WebDAV currently authenticates with app user flow. Multi-user scope will need careful path isolation.

### 6.6 Maintenance

Remaining:

- Rotate activity logs.
- Admin cleanup actions for thumbnails/trash/logs. Chunks and expired trash are partially implemented.
- Trash search/filter.
- Restore-to action.
- Restore dry-run before extracting backup.
- Low-disk warnings.
- External backup hooks for restic/Borg/rclone.
- Export/import app metadata.

### 6.7 Packaging And Release Structure

The user explicitly requested the project be released very structurally, including a Kubernetes image on GitHub.

Remaining packaging/release tasks:

- Add hardened compose profile for advanced users.
- Add `--no-systemd` installer option.
- Add `run.sh --no-build`.
- Add CLI commands for user creation and password reset.
- Add release checklist.
- Add migration notes from current Nodi.
- Add first-run setup output with admin URL, LAN URLs, password, storage path.
- Add systemd hardening that does not break large uploads.
- Add upgrade instructions preserving storage and metadata.
- Add Docker healthcheck and Kubernetes probes.
- Add release artifacts for Linux amd64 and arm64.
- Add GitHub Actions workflow to build and publish container images to GitHub Container Registry.
- Add Kubernetes manifests or Helm chart/kustomize base for deployment.

## 7. New Required Deliverable: GitHub Image And Kubernetes Deployment

This is a user-added requirement and should be treated as required before release.

### 7.1 GitHub Container Registry

Required:

- Publish image to `ghcr.io/twarga/nodi`.
- Support tags:
  - `latest`
  - semver tags like `v0.1.0`
  - commit SHA tags for traceability
- Build multi-arch images:
  - `linux/amd64`
  - `linux/arm64`
- Use GitHub Actions with Docker Buildx.
- Include image labels:
  - source repository
  - revision
  - version
  - license

Suggested workflow file (already exists, do not duplicate):

- `.github/workflows/docker-publish.yml`

Suggested workflow behavior:

- On push to `main`, build and publish `latest` and SHA tag.
- On Git tag `v*`, build and publish semver tag.
- On pull request, build but do not publish.
- Use `docker/metadata-action`.
- Use `docker/setup-buildx-action`.
- Use `docker/login-action` for GHCR.
- Use `docker/build-push-action`.

Acceptance:

- `docker pull ghcr.io/twarga/nodi:latest` works after release.
- Image starts with mounted `/nodi_files`.
- Image works with `QL_PASS_HASH` or `QL_BOOTSTRAP_PASSWORD`.
- Image does not require writable root filesystem except intended writable volumes.
- Large uploads do not use tmpfs.

### 7.2 Kubernetes Manifests

Required:

- Provide Kubernetes deployment manifests in repo.
- Do not make users hand-write YAML from README.

Recommended structure:

```text
deploy/
  kubernetes/
    README.md
    namespace.yaml
    secret.example.yaml
    pvc.yaml
    deployment.yaml
    service.yaml
    ingress.example.yaml
    kustomization.yaml
```

Minimum Kubernetes resources:

- Namespace: `nodi`
- Secret for auth:
  - `QL_USER`
  - `QL_PASS_HASH` or `QL_BOOTSTRAP_PASSWORD`
  - `QL_COOKIE_SECRET`
- PersistentVolumeClaim:
  - mounted to `/nodi_files`
  - must support large files
- Deployment:
  - image `ghcr.io/twarga/nodi:latest`
  - port `7319`
  - env vars for `QL_HOST=0.0.0.0`, `QL_PORT=7319`, `QL_ROOT=/nodi_files`, `GOTMPDIR=/nodi_files/.cache/tmp`
  - volume mount for `/nodi_files`
  - optional `emptyDir` or PVC mount for `/tmp` if necessary, but do not use memory-backed tmpfs for uploads
  - readiness probe: `/api/health`
  - liveness probe: `/api/health`
  - resource requests conservative, resource limits not too tight for large uploads
  - securityContext:
    - run as non-root
    - allow privilege escalation false
    - readOnlyRootFilesystem only if `/tmp` and storage paths are mounted correctly
- Service:
  - ClusterIP on port `7319`
- Ingress example:
  - optional
  - must mention large body upload proxy settings
  - must mention timeouts for large uploads

Ingress warning:

- For NGINX Ingress, document annotations like:
  - `nginx.ingress.kubernetes.io/proxy-body-size: "0"` or a deliberate large limit
  - `nginx.ingress.kubernetes.io/proxy-read-timeout`
  - `nginx.ingress.kubernetes.io/proxy-send-timeout`
- For Traefik/Caddy, document equivalent large upload/timeouts.

Acceptance:

- `kubectl apply -k deploy/kubernetes` should deploy a working LAN/internal instance after user creates a valid secret.
- README documents how to generate:
  - bcrypt password hash
  - cookie secret
  - optional bootstrap password
- Kubernetes deployment must not default to `admin/admin`.
- Kubernetes deployment must not use memory-backed tmpfs for uploads.

### 7.3 Release Documentation

Required docs before release:

- `README.md` updated from “Active remake” to a realistic release status.
- `docs/release-checklist.md` or `RELEASE.md`.
- `deploy/kubernetes/README.md`.
- Migration notes from older Nodi.
- Security guidance:
  - LAN-only default.
  - HTTPS required for remote exposure.
  - Reverse proxy upload body/timeouts must be configured for large files.
  - Admin password must be changed after bootstrap.
- Large-file guidance:
  - recommended storage
  - avoid tmpfs
  - disk space preflight
  - browser/mobile sleep caveats

## 8. Verification Requirements

Run these after relevant changes:

```bash
GOCACHE=/tmp/nodi-gocache go test ./...
```

```bash
cd web/app
npm run build
```

If frontend build runs, expect generated files under `web/static/dist` to change.

If Go tests fail with an `httptest` localhost socket error in sandbox, rerun with elevated permissions if available. Do not mark tests failed due only to sandbox socket restriction if an escalated rerun passes.

Before release, run real-device release gates from `tasks.md`:

- Upload a 20GB file over LAN.
- Upload a 100GB file over LAN.
- Pause Wi-Fi mid-upload and confirm resume.
- Close browser mid-upload and confirm resume after reopening.
- Upload a folder with 10k files and preserve structure.
- Download a folder as archive without server OOM.
- Share a password-protected folder and verify no password appears in URL.
- Create a public dropbox and upload from another device.
- Mount via WebDAV from at least one desktop OS.
- Upload from a phone browser.
- Restore deleted files from trash.
- Verify abandoned upload cleanup.
- Verify disk-full behavior is understandable and safe.
- Run `go test ./...`.
- Run frontend build.
- Run security scan before release.

## 9. Known Technical Details

Backend:

- Go server entry: `cmd/server/main.go`
- Config: `internal/config/env.go`
- Main file handler collection: `internal/handlers/files.go`
- Backup/restore: `internal/handlers/backup.go`
- Shares: `internal/handlers/shares.go`
- WebDAV: `internal/handlers/webdav.go`
- Devices/LAN URLs: `internal/handlers/devices.go`
- Health/stats: `internal/handlers/stats.go`

Frontend:

- API client: `web/app/src/lib/api.ts`
- Upload hook/global queue: `web/app/src/hooks/useUpload.ts`
- Upload panel: `web/app/src/components/UploadPanel.tsx`
- Main file browser: `web/app/src/pages/Dashboard.tsx`
- Settings: `web/app/src/pages/Settings.tsx`
- Send page: `web/app/src/pages/Send.tsx`
- Share page: `web/app/src/pages/Share.tsx`
- Devices page: `web/app/src/pages/Devices.tsx`
- App routing: `web/app/src/App.tsx`, `web/app/src/lib/router.ts`

Container/deploy:

- `Dockerfile`
- `docker-compose.yml`
- `docker-compose.caddy.yml`
- `Caddyfile.example`
- `.env.example`
- `install.sh`
- `run.sh`

## 10. Important Implementation Notes

### Uploads

Do not reintroduce `ParseMultipartForm` for large upload paths.

Normal uploads:

- Must use `MultipartReader`.
- Must write to temp file in destination directory.
- Must atomically rename to final path.
- Must remove temp files on failure.

Chunked uploads:

- Must use server-issued upload IDs.
- Must validate upload ID, filename, chunk index, paths.
- Must write chunk temp file, then rename to `<index>.part`.
- Must assemble to destination temp file, then rename.
- Must not leave final file on failed assembly.
- Must keep failed/incomplete sessions resumable unless explicitly canceled or TTL cleanup runs.

Frontend:

- Must persist upload session to localStorage.
- Must call `/api/upload/status` when resuming.
- Must reconcile status after network error because a chunk may have landed even if browser lost response.

### Backup

Default backup is now TAR, not ZIP.

- `/api/backup` returns streaming TAR.
- `/api/backup?format=zip` returns legacy ZIP.
- Restore supports `.tar` and `.zip`.

Do not revert default backup to ZIP. ZIP can be retained only as legacy/compatibility option.

### Auth

Config rejects known unsafe cookie secrets.

Fresh installer should not ship public `admin/admin` hash by default.

Current config supports:

- `QL_PASS_HASH`
- or `QL_BOOTSTRAP_PASSWORD` if no hash is provided

`QL_BOOTSTRAP_PASSWORD` is hashed in memory at boot. Long-term, users should change password from Settings and persist a bcrypt hash.

### Shares

New share tokens are strong and stored as hashes.

Consequence:

- Raw link token cannot be reconstructed later from metadata.
- UI should tell users the link is shown at creation.
- Revocation still works by raw token or stored hash/reference.

Do not store new raw share tokens in `.nodishare.json`.

### Metadata Exclusion

App metadata must not be exposed in:

- search
- recent files
- WebDAV
- backup
- public shares

Existing app metadata examples:

- `.cache`
- `.trash`
- `.nodishare.json`
- `.nodifav.json`
- `.nodilog.jsonl`
- `.nodi-*`

## 11. Suggested Next Work Order

Recommended next model sequence. The previous order buried the frontend behind packaging; that is wrong. Frontend acceptance is the first release gate.

1. **Pass the §4.2 frontend acceptance gates.** No-card screenshot review, mobile-first check, focus/keyboard review, real-device drag/drop. Optional clarity refactor in parallel: rename `web/app/src/pages/Dashboard.tsx` → `Files.tsx` and update the import in `web/app/src/App.tsx:5,47`. The current `DashboardPage` already serves the new design — the rename is for naming clarity, not a wiring fix. No backend work in parallel with this — fix what's already shipped.
2. **Run the manual release gates for upload safety** (§6.1 + `tasks.md` Phase 10). Disk-space preflight, disk-full errors, and post-upload SHA-256 reporting are now implemented in code; they still need real-device validation.
3. **Verify the Kubernetes manifests** under `deploy/kubernetes` (§7.2). **GHCR is already done** — `.github/workflows/docker-publish.yml:76` publishes multi-arch images to `ghcr.io/twarga/nodi` on `main` and on `v*` tags. No new workflow file is required. Verify the existing workflow meets §7.1 acceptance (multi-arch `linux/amd64` + `linux/arm64`, image labels for source/revision/version/license, no tmpfs for uploads, `QL_PASS_HASH` / `QL_BOOTSTRAP_PASSWORD` support) and document the verified behavior in `deploy/kubernetes/README.md`.
4. **Add release checklist and migration docs** (§7.3).
5. **Add `--no-systemd` installer option and `run.sh --no-build`**.
6. **Add Docker/Kubernetes healthcheck documentation** (probes already wired to `/api/health`).
7. **Finish the remaining mobile/frontend acceptance evidence**: real phone checks, no-card audit, focus review.
8. **Finish the remaining sharing polish**: revoked-tab behavior, share download limits, QR per share, one-time links.
9. **Add activity log rotation and cleanup**.
10. **Start multi-user/account system only after release packaging is structured.**

Rationale:

- The previous handoff overstated frontend completion. Frontend is a release gate, not polish. Do not move past step 1 until §4.2 passes with evidence.
- Disk-full behavior is the biggest remaining data-safety gap.
- Kubernetes is explicitly required by the user and now has a first pass under `deploy/kubernetes/`. The next step is validation on a real cluster, not fresh scaffold work. GHCR is already implemented in `.github/workflows/docker-publish.yml` — verify it against §7.1 and document the actual workflow file name in the release notes.
- Release structure is needed before adding more Google Drive polish.
- Multi-user is large and risky; do it after the app is releasable for one/admin user.

## 12. Completion Definition

Do not call the remake finished until all of these are true:

- All P0 implementation tasks are complete.
- Broad top-level non-negotiables in `tasks.md` have been audited and checked only with evidence.
- Real-device Phase 10 release gates have been executed and documented.
- `go test ./...` passes.
- `npm run build` passes.
- Docker image builds locally.
- GHCR image publishing workflow exists and is documented.
- Kubernetes manifests deploy a working app using the GHCR image.
- README is updated for release, not just active-remake status.
- Security/release checklist exists.
- No default public admin credentials remain in release paths.
- Large uploads do not depend on tmpfs or tight memory limits.

## 13. Current Main Risks

Highest risk:

- **Frontend acceptance has not been audited.** The new design system is in `web/app/src/index.css` and pages/components are rebuilt, but the no-card / mobile-first / focus-keyboard gates in §4.2 are not yet run with evidence. The previous handoff treated frontend as done; it isn't.
- **Disk-full behavior is not yet proven safe.**
- **Real 20GB/100GB upload gates are not yet run.**
- **Real network interruption/phone browser gates are not yet run.**
- **Multi-user/account/quotas are not yet implemented.**
- **Kubernetes release path now exists** under `deploy/kubernetes/`, but it is not yet validated on a real cluster.

Medium risk:

- Huge-folder browsing still needs pagination/virtualization.
- Thumbnail cache collision/cleanup is not finished.
- Activity log rotation is not finished.
- Share expiration UI/dropbox limits/share activity are implemented; richer dashboard behavior still needs revoked/download-limit polish.
- Installer/systemd hardening needs more structure.

Lower risk:

- UI polish features like command palette, saved views, image gallery, labels/tags.

## 14. Final Instruction For Continuation

Continue from `tasks.md`, but treat this handoff as the release-structure overlay. The user specifically asked for:

- A real app, not a prototype.
- Very easy UI, mobile drag/drop/send flow.
- Large-file correctness.
- A structured release.
- GitHub-hosted container image.
- Kubernetes deployment support.

Prioritize work that makes the app releasable and safe before adding broad Google Drive polish.
