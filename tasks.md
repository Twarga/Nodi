# Nodi Remake Tasks

Goal: remake Nodi into a dependable home-network file hub: large-file uploads, simple drag-and-drop, mobile-first sending, safe sharing, and real cross-device access.

Product direction: Google Drive convenience + AirDrop simplicity + homelab reliability. Avoid Nextcloud-style bloat.

## Product Promise

Nodi should feel simple enough for family use, but reliable enough for real work:

- Open it from any phone, laptop, desktop, or tablet on the home network.
- Drag files or folders into the browser and trust that large uploads finish safely.
- Pause, resume, refresh, lose Wi-Fi, and continue without corrupting files.
- Browse, preview, search, share, and recover files without learning server details.
- Mount it from real operating systems when browser upload is not enough.

## Priority Legend

- `P0` means required before calling the remake usable.
- `P1` means required before calling it good.
- `P2` means high-value polish that makes it feel close to Google Drive.
- `P3` means advanced or optional after the core product is stable.

## Non-Negotiables

- [ ] `P0` Never buffer large files in RAM.
- [ ] `P0` Never spill large uploads to tmpfs.
- [ ] `P0` Never leave a partially assembled file at the final destination path.
- [ ] `P0` Never overwrite a user file silently.
- [ ] `P0` Never put passwords or private tokens in URLs.
- [ ] `P0` Never expose app metadata folders in search, recent files, WebDAV, backup, or shares.
- [ ] `P0` Make every destructive action recoverable or clearly confirmed.
- [ ] `P0` Make mobile upload a first-class path, not a squeezed desktop screen.
- [ ] `P1` Keep the default install LAN-safe and understandable.
- [ ] `P1` Require explicit HTTPS guidance before remote exposure.

## Phase 0 - Large File Foundation

- [x] `P0` Replace all upload paths with streaming-to-disk behavior.
- [x] `P0` Ensure normal multipart uploads never use `ParseMultipartForm`.
- [x] `P0` Ensure chunks write to `<root>/.cache/uploads/<uploadId>/`.
- [x] `P0` Make upload IDs server-issued instead of client-generated.
- [x] `P0` Add `POST /api/upload/start` to create upload metadata.
- [x] `P0` Add `GET /api/upload/status?uploadId=...` for resume discovery.
- [x] `P0` Add `DELETE /api/upload/:uploadId` for cancel and cleanup.
- [x] `P0` Add resumable upload metadata: filename, size, chunk size, total chunks, destination path, created time.
- [x] `P0` Assemble chunks into a temp file in the destination directory.
- [x] `P0` Rename assembled temp file atomically into final path.
- [x] `P0` Reject invalid upload IDs, chunk indexes, filenames, paths, and total chunk counts.
- [x] `P0` Add per-chunk size limit config, default `16MB`.
- [x] `P0` Add upload janitor for abandoned chunks older than 48 hours.
- [x] `P0` Remove request body timeouts that kill slow 20GB-100GB uploads.
- [x] `P0` Keep `ReadHeaderTimeout` for slowloris protection.
- [x] `P0` Remove Docker tmpfs upload defaults.
- [x] `P0` Remove Docker 512MB memory cap from default compose.
- [x] `P0` Route Go temp files to real storage with `GOTMPDIR`.
- [x] `P0` Add large upload regression tests using generated streams.
- [x] `P0` Add chunk resume tests.
- [x] `P0` Add crash/interruption tests for incomplete final files.
- [x] `P1` Add disk-space preflight before starting known-size uploads.
- [x] `P1` Add clear "disk full" upload error with safe cleanup.
- [x] `P1` Add upload integrity verification option using SHA-256 after completion.

## Phase 1 - Reliable Upload UX

- [x] `P0` Persist in-progress uploads in browser storage.
- [x] `P0` Resume uploads after refresh.
- [x] `P0` Resume uploads after network failure.
- [x] `P0` Add retry with exponential backoff and jitter.
- [x] `P0` Upload chunks concurrently with a safe default of 3 workers.
- [x] `P0` Track progress by completed bytes plus in-flight bytes.
- [x] `P0` Add pause, resume, cancel, and retry controls.
- [x] `P0` Warn before closing tab while uploads are active.
- [x] `P1` Show upload speed and estimated time remaining.
- [x] `P1` Show per-file error reasons.
- [x] `P0` Handle duplicate names with choices: skip, replace, keep both.
- [x] `P0` Support uploading multiple files with identical names from different folders.
- [x] `P0` Add folder upload from file picker using `webkitdirectory`.
- [x] `P0` Add drag-and-drop folder traversal using browser directory APIs.
- [x] `P0` Preserve folder structure during upload.
- [x] `P0` Add mobile upload mode with camera/gallery/file picker.
- [x] `P0` Add a simple "Send files" screen optimized for touch.
- [x] `P1` Add "keep screen awake" helper for long mobile uploads where supported.
- [x] `P1` Add mobile warning when browser/background sleep may pause upload.
- [x] `P1` Add upload queue grouping by folder.
- [x] `P2` Add transfer history with success, skipped, failed, canceled, and retryable states.
- [ ] `P2` Add bandwidth limit setting for weak home networks.

## Phase 2 - Clear App Structure

- [x] Redesign navigation around Home, Files, Send, Share, Devices, Settings.
- [x] Add Home dashboard with upload CTA, recent files, active uploads, storage usage, and LAN URL.
- [x] Make Files the full browser and manager.
- [x] Make Send the fastest path to upload from phone or laptop.
- [x] Make Share the place to manage links and dropboxes.
- [x] Make Devices explain LAN URLs, QR codes, WebDAV, and app install.
- [x] Add a persistent upload panel visible across routes.
- [ ] Add clear empty states for first-time use.
- [ ] Add responsive mobile layout for all primary flows.
- [ ] Improve drag overlay to explain files and folders are accepted.
- [ ] Add keyboard shortcuts only after core touch UX is solid.
- [ ] `P1` Add onboarding screen with LAN URL, QR code, storage path, and default admin safety warning.
- [ ] `P1` Add "what can I do here?" hints for Home, Files, Send, Share, and Devices.
- [ ] `P2` Add command palette for desktop power use.
- [ ] `P2` Add saved view preference: grid, list, compact, sort, hidden files.

## Phase 3 - File Manager Essentials

- [x] Add bulk download from selection.
- [x] Add bulk move.
- [x] Add bulk copy.
- [x] Add bulk delete.
- [x] Add bulk share.
- [x] Add bulk compress.
- [x] Fix folder download to automatically request zip or tar.
- [x] Add streamed archive downloads for selected files.
- [x] Add conflict-safe move and copy that never silently overwrite.
- [ ] Add "new folder" and "new file" flows with consistent validation.
- [ ] Add breadcrumb path copy.
- [ ] Add favorites or pinned folders.
- [ ] Add recent files recursively, skipping app metadata folders.
- [ ] Add fast sorting by name, size, type, and modified date.
- [ ] Add server-side pagination or virtualized browsing for huge folders.
- [ ] Add stable thumbnail cache keys based on full path or hash.
- [ ] Add thumbnail cache size limit and cleanup.
- [ ] `P1` Add copy direct file link for authenticated LAN users.
- [ ] `P1` Add recursive folder size calculation on demand.
- [ ] `P1` Add batch rename basics.
- [ ] `P2` Add file version history for replaced files.
- [ ] `P2` Add duplicate finder by hash and size.
- [ ] `P2` Add "open containing folder" from search, recents, shares, and activity.
- [ ] `P3` Add optional local folder watcher to index files changed outside Nodi.

## Phase 4 - Search And Preview

- [x] Add filename search across the whole storage root.
- [x] Add filters for type, size range, date range, and folder.
- [x] Add search result previews.
- [x] Add image preview.
- [x] Add video preview with range streaming.
- [x] Add audio preview.
- [x] Add PDF preview.
- [x] Add text and code preview.
- [x] Add safe inline text editing for small text files.
- [x] Add optional file hash calculation on demand.
- [x] Add metadata sidebar with size, modified date, path, MIME type, and download/share actions.
- [ ] `P1` Add search result keyboard navigation.
- [ ] `P1` Add search by extension and exact filename.
- [ ] `P2` Add optional full-text index for text, PDF metadata, and common document names.
- [ ] `P2` Add saved searches.
- [ ] `P2` Add image gallery mode with next/previous navigation.
- [ ] `P2` Add video subtitle sidecar detection.
- [ ] `P3` Add optional OCR for images and scanned PDFs.

## Phase 5 - Sharing

- [x] Rewrite shared folder rendering with `html/template` escaping.
- [x] Remove share passwords from URLs.
- [x] Add share unlock via POST and short-lived cookie.
- [x] Add read-only file share links.
- [x] Add read-only folder share links.
- [x] Add password-protected links.
- [x] Add expiring links.
- [x] Add one-click link copy.
- [x] Add share revoke.
- [x] Add public upload dropbox links.
- [x] Add dropbox password or PIN.
- [x] Add dropbox max file size and max file count.
- [x] Add dropbox upload progress page.
- [x] Add share activity events.
- [x] Add clear public share page UI for mobile.
- [x] `P0` Ensure every share token is unguessable and stored hashed or protected where practical.
- [ ] `P1` Add share dashboard with active, expired, revoked, and dropbox tabs.
- [ ] `P1` Add share download limits.
- [ ] `P1` Add share view/download/upload audit events.
- [x] `P1` Add share owner and created-by metadata.
- [ ] `P2` Add QR code for each share link.
- [ ] `P2` Add temporary "send once" links that auto-revoke after first download.
- [ ] `P2` Add public share branding and clear expiry/password indicators.

## Phase 6 - Cross-Device Access

- [x] Add QR code for LAN URL.
- [x] Show all detected LAN addresses at startup and in Devices page.
- [x] Add PWA manifest.
- [x] Add installable app icons.
- [x] Add offline-safe shell for upload queue recovery.
- [x] Add WebDAV endpoint at `/dav`.
- [x] Authenticate WebDAV with app users.
- [x] Document Windows network drive setup.
- [x] Document macOS Finder setup.
- [x] Document Linux/rclone setup.
- [x] Document Android file manager setup.
- [x] Document iPhone/iPad Files app options.
- [x] Add Caddy compose for HTTPS reverse proxy.
- [x] Add guidance for LAN-only vs remote exposure.
- [ ] `P1` Add copy buttons for browser URL, WebDAV URL, and LAN URLs.
- [ ] `P1` Add "test WebDAV login" button.
- [ ] `P1` Add Bonjour/mDNS name guidance or optional service announcement.
- [ ] `P2` Add Syncthing/rclone recipe page for users who want real sync.
- [ ] `P2` Add SMB/NFS guidance as external alternatives, not built-in scope.

## Phase 7 - Accounts And Safety

- [ ] Add users file stored under app metadata.
- [ ] Support admin and regular users.
- [ ] Scope regular users to their home directories.
- [ ] Add admin UI for creating users.
- [ ] Add admin UI for password reset.
- [ ] Add per-user quota.
- [ ] Enforce quota before and during upload.
- [ ] Add per-user activity log filtering.
- [ ] Change logout to revoke only current session.
- [ ] Add "sign out everywhere".
- [x] Revoke sessions after password change.
- [x] Reject unsafe cookie secret defaults on boot.
- [x] Remove public default admin password from installer.
- [x] Generate one-time admin password during install.
- [ ] `P1` Add user avatar or initials for clear account identity.
- [ ] `P1` Add per-user WebDAV credentials or app passwords.
- [ ] `P1` Add login attempt lockout and clear recovery guidance.
- [ ] `P1` Add audit log entries for login, logout, password change, share creation, and deletes.
- [ ] `P2` Add two-factor authentication using TOTP.
- [ ] `P2` Add trusted device/session list.
- [ ] `P3` Add OIDC only if the simple household account model remains clean.

## Phase 8 - Trash, Backup, And Maintenance

- [x] Replace encoded trash filenames with UUID trash folders.
- [x] Store trash metadata as `meta.json`.
- [x] Add trash listing endpoint.
- [x] Add restore endpoint using trash metadata.
- [x] Add permanent delete endpoint.
- [x] Add empty trash button.
- [x] Add trash retention config, default 30 days.
- [x] Add background trash janitor.
- [ ] Rotate activity logs.
- [x] Exclude app metadata from user backups.
- [x] Replace synchronous huge zip backup with streaming or snapshot-safe backup.
- [x] Add health page: disk free, active uploads, abandoned chunks, version, uptime.
- [ ] Add admin cleanup actions for chunks, thumbnails, trash, and logs. Partial: chunks and expired trash are implemented.
- [x] `P0` Ensure trash restore never overwrites an existing destination without conflict choice.
- [ ] `P1` Add trash search and filter by original folder/date/type.
- [ ] `P1` Add "restore to..." action.
- [x] `P1` Add backup format that can stream very large datasets without huge memory use.
- [ ] `P1` Add restore dry-run summary before extracting backup.
- [ ] `P1` Add maintenance warnings when disk free space is low.
- [ ] `P2` Add scheduled backup hooks for restic/Borg/rclone instead of building a full backup product.
- [ ] `P2` Add export/import app metadata: users, shares, settings, favorites.

## Phase 9 - Installer And Packaging

- [x] Update Dockerfile for large-file defaults.
- [x] Update default compose for large uploads.
- [ ] Add hardened compose profile for advanced users.
- [x] Add Caddy compose file.
- [x] Update README around LAN-first usage.
- [x] Update install script to generate secrets and admin password.
- [ ] Add `--no-systemd` installer option.
- [ ] Add `run.sh --no-build`.
- [ ] Add CLI commands for user creation and password reset.
- [ ] Add release checklist.
- [ ] Add migration notes from current Nodi.
- [x] `P0` Add `.env.example` with large-file-safe defaults.
- [ ] `P1` Add first-run setup that prints admin URL, LAN URLs, password, and storage path.
- [ ] `P1` Add systemd service hardening that does not break large uploads.
- [ ] `P1` Add upgrade instructions that preserve storage and metadata.
- [ ] `P1` Add healthcheck endpoint and Docker healthcheck.
- [ ] `P2` Add one-command backup of config/metadata, not user files.
- [ ] `P2` Add release artifacts for Linux amd64 and arm64.

## Phase 10 - Release Gates

- [ ] Upload a 20GB file over LAN.
- [ ] Upload a 100GB file over LAN.
- [ ] Pause Wi-Fi mid-upload and confirm resume.
- [ ] Close browser mid-upload and confirm resume after reopening.
- [ ] Upload a folder with 10k files and preserve structure.
- [ ] Download a folder as archive without server OOM.
- [ ] Share a password-protected folder and verify no password appears in URL.
- [ ] Create a public dropbox and upload from another device.
- [ ] Mount via WebDAV from at least one desktop OS.
- [ ] Upload from a phone browser.
- [ ] Restore deleted files from trash.
- [ ] Verify abandoned upload cleanup.
- [ ] Verify disk-full behavior is understandable and safe.
- [x] Run `go test ./...`.
- [x] Run frontend build.
- [ ] Run security scan before release.

## Phase 11 - Near Google Drive Quality

These are not all required for the first remake release, but they are the features that make Nodi feel polished instead of "just a file server with a UI."

- [ ] `P1` Make every core action work well on phone: upload, preview, search, share, delete, restore.
- [ ] `P1` Add excellent loading, empty, error, offline, and permission states.
- [ ] `P1` Add clear human messages for path conflicts, quota failure, disk full, expired share, wrong password, and network loss.
- [ ] `P1` Add file details drawer with path, size, type, modified date, owner, share status, hash, and activity.
- [ ] `P1` Add global recent activity feed.
- [ ] `P1` Add favorites/starred files and folders.
- [ ] `P1` Add "shared with me" or "shared by me" view for household users.
- [ ] `P2` Add file comments or notes stored as metadata.
- [ ] `P2` Add labels/tags.
- [ ] `P2` Add version history when replacing files.
- [ ] `P2` Add conflict copies like `filename (1).ext` with clear UI.
- [ ] `P2` Add quick preview carousel for images and media.
- [ ] `P2` Add smart media organization by date taken where EXIF exists.
- [ ] `P2` Add duplicate cleanup workflow.
- [ ] `P2` Add local-only "available offline" guidance through WebDAV/rclone/Syncthing instead of building a fragile sync client too early.
- [ ] `P2` Add import from phone camera roll via mobile browser picker.
- [ ] `P2` Add public request-file workflow: create dropbox, copy link, receive uploads into chosen folder.
- [ ] `P2` Add share expiration presets: 1 hour, 1 day, 7 days, 30 days, custom.
- [ ] `P2` Add admin dashboard for users, storage, active uploads, shares, trash, and health.
- [ ] `P3` Add background indexing for full-text search.
- [ ] `P3` Add optional desktop sync companion only after the web and WebDAV product is stable.
- [ ] `P3` Add optional end-to-end encrypted folder mode only if threat model is clear.

## Recommended Build Order

1. Finish every unchecked `P0` item in Phases 0, 1, 5, 8, and 9.
2. Run Phase 10 release gates with real large files on the home network.
3. Finish `P1` mobile UX, installer, WebDAV, accounts, and health items.
4. Add `P2` Google Drive polish only after uploads, recovery, and sharing are boringly reliable.
5. Avoid `P3` features until the core product has been used daily without data-loss bugs.
