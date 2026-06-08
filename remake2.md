# Nodi — Remake Plan v2

A focused remediation plan to turn Nodi into a minimal, dependable, homelab-friendly alternative to Google Drive — not Nextcloud. The goal is a single binary + single Docker image that one person can run on an old laptop, expose on the LAN (or via a reverse proxy on the WAN), and actually trust with 20–100 GB uploads.

This document is the outcome of a full read of the current codebase. Every issue below is a real bug or real gap I can point at in the source, not theoretical.

---

## 1. Vision and guardrails

What Nodi is:

- A **personal file manager** for one human (you) or a small household, running on one node.
- A **browser-first** client: drag, drop, preview, share. No forced sync client, no apps, no plugins.
- A **single process** in Go that streams files to and from a single directory on disk. No database, no Redis, no S3, no queue.

What Nodi is **not** (keep ripping this out when it appears):

- Not a collaboration platform. No Office, no Talk, no calendars, no contacts, no flow, no groupware.
- Not a multi-tenant SaaS. Two to five users at most, sharing the same root.
- Not a full backup/sync system. It can *back itself up*, not replace BorgBackup/restic.
- Not a media server. Previews yes, transcoding no.

Every feature below that doesn't fit this stays out. That is the whole point of preferring Nodi over Nextcloud.

### Non-negotiable principles

1. **Never buffer a file in RAM or tmpfs.** Large uploads must stream to disk in the user's storage volume.
2. **Never hold an HTTP request open longer than it takes to stream.** No synchronous zip-the-whole-root on the request goroutine.
3. **Never put user input into a path without validation.** Every file name, flow ID, chunk index, share token and restore name gets validated or rejected.
4. **Never auto-generate HTML that contains unescaped user input.** Server-rendered listings must use `html/template`.
5. **Session lifetime is a per-user decision.** Logging out one device must not kick everyone out.
6. **Defaults must be safe.** No ambient `admin:admin` after install, no plaintext cookie secret, no world-writable shares.

---

## 2. Why it's "extremely buggy" right now

The audit turned up issues in every layer. Grouped by impact:

### 2.1 Why large uploads fail (20 GB–100 GB)

| # | Location | Problem | Consequence |
|---|----------|---------|-------------|
| A1 | `internal/handlers/files.go` `Upload()` | `r.ParseMultipartForm(32<<20)` loads 32 MB into RAM and spills the rest to `os.TempDir()`. | On the shipped Docker image, `/tmp` is a **tmpfs** (RAM). A 50 GB upload tries to stage 50 GB in RAM. Container is memory-capped at **512 MB**. OOM kill. |
| A2 | `docker-compose.yml` | `read_only: true`, `tmpfs: /tmp`, `deploy.resources.limits.memory: 512M`. | Exactly the profile that breaks A1. |
| A3 | `cmd/server/main.go` | `ReadTimeout: 30 * time.Minute`, `WriteTimeout: 60 * time.Minute`. | A 100 GB upload on a typical 100 Mbps home upstream needs ~2.2 h. Connection times out and the whole thing is lost. |
| A4 | `web/app/src/lib/api.ts` chunked upload | Chunks sent **sequentially** with 8 MB size and no resume. | 100 GB = 12,500 chunks × round-trip latency. A single failed request (browser tab closes, laptop sleeps, Wi-Fi drops) loses everything because `flowId` is regenerated on reload. |
| A5 | `ChunkUpload` handler | No per-chunk size cap, no total-file cap, no resume endpoint. | Flow state lives on disk under `.cache/uploads/{flowId}_{i}` forever if the client gives up. Disk fills silently. |
| A6 | `ChunkComplete` handler | Assembles directly into the destination path (no temp + atomic rename). | A crash or disconnect during assembly leaves a half-written file that looks real. |
| A7 | `ChunkComplete` handler | `req.FileName` is **not** re-validated with `validName()` before `filepath.Join`. | Path traversal via the completion call. |
| A8 | `ChunkUpload` handler | `flowID` and `chunkIndex` come from form fields and go straight into `filepath.Join(chunkDir, flowID+"_"+chunkIdx)`. | `flowID = "../../evil"` escapes `.cache/uploads/`. Attacker (authenticated) can write anywhere under `QL_ROOT`. |

Add all of the above together and the answer to "why can't I upload my 40 GB archive?" is: **the entire upload path — frontend, handler, storage, container — was designed for files that fit in RAM.**

### 2.2 Security issues

| # | Location | Problem |
|---|----------|---------|
| S1 | `ServeShare` in `internal/handlers/shares.go` | Builds HTML directory listings with `fmt.Fprintf(w, ..., name)`. Filenames are written into `<a>` tags and into the `href` attribute unescaped. **Stored XSS** as soon as a shared folder contains a file named `<script>...</script>`. |
| S2 | `ServeShare` | Share password is accepted via `?password=` in the URL. Winds up in server logs, reverse-proxy access logs, and `Referer` headers. |
| S3 | `ServeShare` | `mode: "upload"` is accepted by `CreateShare` and persisted in `.nodishare.json`, but `ServeShare` never implements a POST path. The feature is exposed in the UI and does nothing. |
| S4 | `internal/middleware/csrf.go` | A fresh CSRF token is generated on every safe GET (`SetCSRFCookie` replaces the cookie on every page/asset/navigation request). This is brittle (races with concurrent POSTs) and unnecessary — one per session is enough. |
| S5 | `internal/handlers/password.go` `ChangePassword` | Writes the new hash but **does not** call `auth.RevokeAllSessions`. Old cookies keep working after a password change. The comment claims logout handles it; logout is a separate action. |
| S6 | `internal/auth/session.go` | `sessionVersion` is **global**. Logging out on phone kicks admin off laptop, and invalidates every other active session (including future shares if they ever use sessions). |
| S7 | `internal/handlers/files.go` `Restore()` | Calls `os.Rename(srcPath, dstPath)` twice; second call is dead code. After `os.Rename` succeeds, also calls `os.MkdirAll(filepath.Dir(dstPath), ...)` on the already-renamed path. And `req.Name` is **not validated**: a crafted trash name with `@` characters restores to an arbitrary path inside root (e.g. restoring `..@etc@passwd@123` decodes to `../etc/passwd` which `SafePath` is not called on). |
| S8 | `moveToTrash` | Uses `@` as the path separator encoder. Filenames containing `@` silently collide and get restored to the wrong location. |
| S9 | `Move` / `Copy` handlers | No existence check on destination. `os.Rename` silently overwrites an existing file or directory. |
| S10 | `Favorite` / `shares` | `.nodifav.json` and `.nodishare.json` are read-modify-write without a file lock. Concurrent calls corrupt the JSON. |
| S11 | `install.sh` | Ships a baked-in bcrypt hash for the password `admin`. Cookie secret is randomized, which is good, but the admin hash is a public value from the repo. If the user skips the "change password" step, their homelab is open. |
| S12 | No HTTPS story in the deployment docs. The install script binds on `0.0.0.0:7319` over plain HTTP. For homelab + WAN exposure this is a loaded gun. |
| S13 | Activity log `.nodilog.jsonl` grows without bound. No rotation, no size cap. For a busy instance this disk-fills over months. |
| S14 | `BackupSkip` does not include `.nodilog.jsonl` — the log ends up inside the user-facing backup, alongside hashed password changes and user paths. |
| S15 | Upload endpoint doesn't scan or cap per-file size beyond the global `MaxUpload`; a single 1 TB file can hit the limit and a user cannot opt out without editing env. |

### 2.3 Correctness and UX bugs

| # | Where | What breaks |
|---|-------|-------------|
| U1 | `Recent` handler (`internal/handlers/files.go`) | Reads only `cfg.Root`, not recursive. "Recent" shows only top-level files modified in the last 7 days, which is almost never useful. |
| U2 | `Thumb` handler | Cache key is `filepath.Base(fullPath) + "_" + size`. Two `photo.jpg` files in different folders collide in the cache. User sees the wrong image. |
| U3 | Trash uses the `@` encoder and a `UnixNano` suffix. Two deletes in the same nanosecond collide (rare but non-zero on fast SSDs + fast requests). Names with `@` break round-trip. No retention (trash grows forever). |
| U4 | Move/Copy silent overwrite (S9 above). Not flagged in UI. |
| U5 | `DropOverlay` uses `DataTransfer.files` which is a **flat list** — dropping a folder on the browser drops only the files at the top. Folder structure is lost. No `DataTransferItemList + getAsFileSystemHandle/webkitGetAsEntry` fallback. |
| U6 | The file input `<input type="file" multiple>` has no `webkitdirectory` variant. You cannot pick a whole folder to upload. |
| U7 | `SelectionBar` only exposes **Delete**. No bulk Download, Move, Copy, Compress, or Share. The backend supports them (`/api/compress`, `/api/move`, `/api/copy`); the UI doesn't wire them. |
| U8 | Downloading a folder from the UI fails: `downloadAPI.downloadUrl(path)` never appends `?format=zip`, and the backend returns 400 for directory downloads without it. |
| U9 | `Dashboard.loadFiles` does not call `setLoading(false)` on the error path — a failed browse leaves the skeleton visible forever. |
| U10 | `uploadFiles` matches progress items by **file name** (`updated.find(p => p.file === u.file)`). If you upload two files with the same name (drop from different folders, or `image.png` in multiple subfolders), their progress bars merge and flicker. |
| U11 | `Backup` handler walks the whole tree and streams a `zip` synchronously. On a 100 GB root this takes hours, holds an HTTP request open, accumulates the zip **central directory** in RAM (zip format requires it), and will be killed by `WriteTimeout`. The feature is effectively broken beyond a few GB. |
| U12 | `RestoreBackup` buffers the entire uploaded zip into a temp file, then extracts. Doubles disk usage. Same multipart-form trap as `Upload`. |
| U13 | `ql-show-hidden` toggle persists across sessions (`localStorage`). Fine — but the backend also filters hidden files server-side, and the frontend filters again, wastefully and inconsistently. Filtering should be server-side only. |
| U14 | Default `run.sh` cookie secret is the literal string `local-development-secret-keep-it-safe-123`. If anyone runs `./run.sh` and exposes port 7319, sessions can be forged. The server should refuse this value. |
| U15 | `validName` rejects null bytes, `\`, `/` — good, but allows Windows reserved names (`CON`, `PRN`, `NUL`, `AUX`, `COM1`–`COM9`, `LPT1`–`LPT9`) and trailing dots/spaces. On Linux that's fine; the Docker image is Linux; if you ever support a Windows backup target this breaks. Minor. |
| U16 | `sessionUserFromCtx` uses `interface{}` and a custom `context` interface. Just take `context.Context` and type-assert. Current code compiles but is confusing. |
| U17 | `config.MaxUpload`: code says default 1 TB (`1099511627776`) in `env.go`, but the Upload and RestoreBackup handlers fall back to `2147483648` (2 GB) if `MaxUpload <= 0`. The effective limit depends on how cfg was built. Tests and docs disagree with each other. |
| U18 | `ql_session` cookie is `SameSite=Strict`. Fine for the SPA, but **breaks shared download links** that require a session (if they ever want to). Not urgent but noteworthy. |

### 2.4 Missing mandatory features for a Drive replacement

These are baseline for anyone who expects "like Google Drive, on my own box":

- **Resumable uploads** that survive browser refresh, laptop sleep, network drop.
- **Folder uploads** (drag a folder, pick a folder).
- **Bulk download** as a streamed zip (no UI, no flag).
- **Public share with password — password sent in a POST, not in the URL.**
- **Public drop-box shares** (the UI advertises `mode: upload` but it does nothing).
- **Multi-user**, even if just 2–5 users. One admin, several normal users with their own home dirs.
- **Quota per user** so one user can't fill the disk.
- **WebDAV** or at least **rclone-compatible HTTP** endpoint so phones/desktops can mount it. A real Drive alternative is reachable from more than a browser. (Optional but expected.)
- **Proper HTTPS / reverse-proxy guidance** out of the box.
- **Trash retention** (auto-empty after N days) and a manual "empty trash".
- **Activity log rotation** and a viewable-per-path audit trail.
- **Backup that actually works on > 5 GB of data** (use `tar+zstd` streaming, or a snapshot-based approach).

---

## 3. Remediation plan

Four phases. Each phase is independently shippable. **P0 is non-negotiable** — without it, the project cannot be recommended to anyone. P1 is what makes it pleasant. P2 is polish. P3 is optional expansion that still fits the minimal-Drive vision.

### P0 — Fix large uploads, stop the bleeding on security (≈ 1 week)

**Objective:** Upload a single 100 GB file from a laptop over home Wi-Fi and recover from a browser crash.

#### P0.1 Streaming upload handler

Replace `Upload()` entirely. Use `mime/multipart` Reader, not `ParseMultipartForm`.

```go
// internal/handlers/files.go (new Upload)
func Upload(cfg *config.Config) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        if r.Method != http.MethodPost { ... }

        // Hard cap, streamed: body beyond limit is rejected without buffering.
        r.Body = http.MaxBytesReader(w, r.Body, cfg.MaxUpload)

        mr, err := r.MultipartReader()
        if err != nil { http.Error(w, "expected multipart", 400); return }

        var subPath string
        results := make([]uploadResult, 0, 4)

        for {
            part, err := mr.NextPart()
            if err == io.EOF { break }
            if err != nil { httpError(w, err); return }

            if part.FormName() == "path" {
                buf, _ := io.ReadAll(io.LimitReader(part, 4096))
                subPath = string(buf)
                part.Close()
                continue
            }
            if part.FormName() != "files" { part.Close(); continue }

            filename := filepath.Base(part.FileName())
            if !validName(filename) {
                results = append(results, uploadResult{Name: filename, Error: "invalid filename"})
                part.Close(); continue
            }
            basePath, err := SafePath(cfg.Root, subPath)
            if err != nil { part.Close(); continue }

            // Stream to temp file in the destination directory (same FS, atomic rename).
            tmp, err := os.CreateTemp(basePath, ".nodi-upload-*")
            if err != nil { ... }

            written, err := io.Copy(tmp, part)
            part.Close()
            if err != nil {
                tmp.Close(); os.Remove(tmp.Name())
                results = append(results, uploadResult{Name: filename, Error: err.Error()})
                continue
            }
            if err := tmp.Close(); err != nil { ... }

            dst := filepath.Join(basePath, filename)
            if _, err := os.Stat(dst); err == nil {
                os.Remove(tmp.Name())
                results = append(results, uploadResult{Name: filename, Error: "file exists"})
                continue
            }
            if err := os.Rename(tmp.Name(), dst); err != nil { ... }
            results = append(results, uploadResult{Name: filename, Size: written})
            storage.Append(cfg.Root, storage.ActivityEvent{Action: "upload", Path: subPath + "/" + filename, User: sessionUserFromCtx(r.Context())})
        }
        writeJSON(w, 200, results)
    }
}
```

Key property: nothing is buffered in RAM or in `os.TempDir()`. Every byte goes straight from the HTTP socket to the destination filesystem.

#### P0.2 Rewrite chunk upload as a real resumable protocol

- Assign `uploadId` on the **server** (not the client). Return it to the browser. Browser persists it in `localStorage` keyed by `(fileName, fileSize, lastModified)`.
- **Validate `uploadId`, chunk index, and filename** before touching the filesystem. `uploadId` regex: `^[a-zA-Z0-9]{16,32}$`. Chunk index regex: `^\d{1,8}$`.
- Chunk directory: `<QL_ROOT>/.cache/uploads/<uploadId>/`. `<uploadId>` is a server-issued token, so traversal is impossible.
- Write each chunk to `chunks/<index>.part` inside the upload dir. Keep a `meta.json` with `{name, size, chunkSize, totalChunks, createdAt}`.
- Assemble to a **temp file** in the destination directory, then `os.Rename` to the final path. Never write to the final path directly.
- Add `GET /api/upload/status?uploadId=...` returning `{received: [0,1,2,4,5]}`. Frontend asks this on page load and resumes from the gap.
- Add `DELETE /api/upload/:uploadId` for cancel + GC.
- Background janitor deletes upload dirs older than 48 h.
- Cap per-chunk size to `cfg.MaxChunkSize` (new config, default 16 MB) with `http.MaxBytesReader`.

Frontend changes:

- `flowId` becomes the server-assigned `uploadId` persisted under
  `localStorage["nodi.upload." + fingerprint(file)]`.
- Parallelism: upload **3 chunks concurrently** (tunable via `cfg.UploadConcurrency`).
- Retry: exponential backoff with jitter, up to 5 attempts per chunk, with connection errors triggering a `GET /api/upload/status` and resuming only missing indices.
- Progress: sum of completed-chunk bytes + in-flight byte counters (XHR `upload.onprogress`), not just per-chunk snap.
- Cancel: `AbortController` in flight + `DELETE /api/upload/:uploadId` cleanup.

#### P0.3 Fix container profile for large uploads

Ship two compose files. The current hardened one is fine only for the small-file image:

```yaml
# docker-compose.yml (default: sensible for homelab use)
services:
  nodi:
    image: ghcr.io/twarga/nodi:latest
    restart: unless-stopped
    ports: ["7319:7319"]
    env_file: [nodi.env]
    volumes:
      - nodi-files:/nodi_files
      # Explicit mount for multipart overflow / temp uploads — NOT tmpfs:
      - nodi-tmp:/tmp
    security_opt: [no-new-privileges:true]
    cap_drop: [ALL]
    # No read_only: false by default; upload chunks need to write under /nodi_files/.cache.
    # No memory limit by default. If the user wants one, they can add it.
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://127.0.0.1:7319/api/health"]
      interval: 30s
      timeout: 5s
      retries: 5
      start_period: 15s
    logging:
      driver: json-file
      options: { max-size: "10m", max-file: "3" }

volumes:
  nodi-files:
  nodi-tmp:
```

- Remove `read_only: true` from the shipped compose (or leave a commented variant).
- Remove the 512 MB memory limit entirely. Streaming the request doesn't need it; Go's GC will keep RSS low on its own. Homelab laptops typically have 8–16 GB.
- Remove `tmpfs: /tmp` as the default. Keep it only in a hardened profile for users who want it and who know their data is < a few GB.
- Set `ENV GOTMPDIR=/nodi_files/.cache/tmp` in the Dockerfile so any accidental use of `os.TempDir()` lands on real storage instead of `/tmp`.

#### P0.4 Server HTTP timeouts for long transfers

`ReadTimeout` **must not** cover the entire request body; it covers inactivity on read. Replace with `ReadHeaderTimeout` + no `ReadTimeout`:

```go
srv := &http.Server{
    Addr:              bindAddr,
    Handler:           handler,
    ReadHeaderTimeout: 30 * time.Second, // headers must arrive fast
    // No ReadTimeout / WriteTimeout — rely on IdleTimeout + per-handler context.
    IdleTimeout:       300 * time.Second,
}
```

For specific handlers that legitimately take a long time (upload, download, stream), wrap them with a context that cancels when the client disconnects (`r.Context().Done()` in copy loops).

#### P0.5 Patch the path-traversal surface

- `Restore()`: validate `req.Name` via `validName`; compute dest via `SafePath(cfg.Root, decodedOrigPath)`; remove the duplicate `os.Rename` + `os.MkdirAll` after success.
- `ChunkComplete`: validate `req.FileName` via `validName`, reject `..`; assemble to temp in the destination dir, then rename.
- `ChunkUpload`: server owns `uploadId`; client never picks it.
- `Favorite`: validate `req.Path` via `SafePath`.
- `Recent`: walk recursively but skip dotfiles.

#### P0.6 Fix ServeShare XSS + password leak

- Replace hand-rolled HTML with `html/template` and autoescape.
- Remove `?password=` querystring. Add `POST /s/:token/unlock` that sets a short-lived `ql_share_<token>` cookie on success; the HTML form posts JSON to it.
- Never log the password.

#### P0.7 Session model fixes

- Kill the global `sessionVersion` counter. Move version to per-user: session JSON embeds a `SessionID`; the server keeps a tiny `map[user]version` in memory (or in `.nodisessions.json`).
- `ChangePassword` calls `RevokeUserSessions(user)` and forces re-login.
- Logout revokes **this** session only (or optionally all of this user's sessions via a "Sign out everywhere" button).

#### P0.8 Refuse unsafe defaults

On boot:

- If `QL_COOKIE_SECRET` is any of: empty, `< 32 bytes`, the default `run.sh` string, or `"change-this..."`, **refuse to start** with a clear error.
- If `QL_PASS_HASH` matches the hash shipped in `install.sh` (the public `admin` hash), print a loud warning at every startup until it's changed. Optionally refuse to listen on a non-loopback address until it's changed.

### P1 — Minimal Drive-like UX (≈ 1–2 weeks)

#### P1.1 Folder uploads

- `<input type="file" webkitdirectory multiple>` button in `WorkspaceBar` (and an existing files button kept).
- Drop handler uses `DataTransferItem.webkitGetAsEntry()` to walk the tree and generate a flat list of `{File, relativePath}`. Missing on Safari → fallback to the flat behaviour with a toast.
- Server side: upload requests can carry a `relativePath` form field per file. The handler creates subfolders inside the upload target.

#### P1.2 Bulk actions in SelectionBar

Add to the selection toolbar: **Download**, **Move**, **Copy**, **Compress**, **Share**. All already exist as API calls; only wiring is needed.

- **Download:** POST to `/api/compress` with the selection; stream a zip back. The handler is already there — just use it.
- **Move / Copy:** open `FolderPicker` in multi-item mode.
- **Compress:** prompt for zip filename, write it to the current folder.
- **Share:** open `ShareModal` preconfigured for the selection (requires backend support to share a "virtual set" — implement as "compress into a hidden folder + share" or as a new endpoint `POST /api/share/selection`).

#### P1.3 Folder download

`downloadAPI.downloadUrl(path, isDir)` appends `?format=zip` when `isDir` is true. The context menu and row double-click both use it.

Server-side: stream the zip progressively. Don't hold it in memory. `zip.Writer` already streams, but the central directory is built in memory — for multi-TB folders, switch to `archive/tar` streaming and expose both.

#### P1.4 Real public share drop-box

Implement `mode: "upload"` in `ServeShare`:

- `GET /s/:token` renders an HTML page rendered by `html/template` with a drop zone that posts to `POST /s/:token/upload` using the same streaming handler as P0.1, with two restrictions: scope is locked to `share.Path`, and filenames still go through `validName`.
- A `maxSize` and `maxFiles` limit on the share entry (optional).
- Password check: same flow as P0.6.

#### P1.5 Trash retention

- `Trash` feature: store deletions under `<root>/.trash/<uuid>/` with a `meta.json` `{originalPath, deletedAt, user}`. No more `@` encoding.
- `/api/trash` GET lists trash items; DELETE purges; POST `/restore` restores using the meta file.
- Background janitor deletes items older than `QL_TRASH_TTL` (default 30 days).

#### P1.6 Thumbnail cache correctness

Cache key becomes `sha1(absPath) + "_" + size`. Eviction: LRU cap at `QL_THUMB_CACHE_MB` (default 512 MB). Cache lives at `<root>/.cache/thumbs/`.

#### P1.7 Recent, Favorites, Activity

- `Recent`: walk `QL_ROOT` (skip `.cache`, `.trash`, dotfiles) with a depth cap (e.g. 6). Return newest 50.
- `Favorites`: one JSON file, protected by `sync.Mutex` + write-via-temp+rename (already partially true for shares; apply consistently).
- `Activity log`: rotate at 10 MB per file, keep 5 files (`.nodilog.jsonl`, `.nodilog.1.jsonl`, …). Strip from backup zips.

#### P1.8 HTTPS and reverse-proxy story

Ship an official `caddy-compose.yml` that runs Caddy + Nodi with automatic Let's Encrypt. Nodi stays plain HTTP behind Caddy. This is the recommended path. Document it in the README as the "WAN exposure" setup.

For LAN-only setups, still document that `QL_COOKIE_SECRET` must be secret and that the installer's default admin hash must be changed.

#### P1.9 Config sanity

- Pick one `MaxUpload` default and keep it (recommend 16 TB — essentially off by default for a homelab). Remove the hidden 2 GB fallback in `Upload` and `RestoreBackup`.
- Add `QL_MAX_CHUNK_SIZE` (default 16 MB) and `QL_UPLOAD_CONCURRENCY` (default 3).
- Add `QL_TRASH_TTL` (default `720h` = 30 d).
- Add `QL_THUMB_CACHE_MB` (default 512).
- Keep config **flat, env-only**. No YAML, no TOML. The appeal over Nextcloud is "one env file".

### P2 — Multi-user, quotas, WebDAV (≈ 2 weeks, optional but recommended)

This is where Nodi stops being "admin's private box" and becomes "small household Drive". **Everything here is optional and OFF by default**, so the single-user minimal mode stays untouched.

#### P2.1 Multi-user

Minimal model:

- `QL_USERS_FILE=/nodi_files/.nodiusers.json` — a tiny JSON file with `[{username, bcryptHash, role, home}]`. Role is `admin` or `user`. `home` is a subpath of `QL_ROOT`.
- Each user's Browse/Upload is scoped to their `home` directory. Admin sees everything.
- Admin UI page: add/remove users, reset password, toggle role.
- No RBAC matrix, no groups, no LDAP. If you want that, pick Nextcloud.

#### P2.2 Per-user quotas

- `quotaBytes` field per user. Computed usage cached (same mechanism as `StorageStats`).
- Upload handler pre-flight: sum of committed size + streaming byte count > quota → 413.

#### P2.3 WebDAV endpoint

Use `golang.org/x/net/webdav` and mount it at `/dav/`. Authentication: HTTP Basic Auth against the same user store, over HTTPS only. This gives:

- Windows Explorer "Map network drive".
- `rclone mount` from any OS.
- Phone apps like Solid Explorer.

One endpoint, ~150 lines of glue. No sync protocol complexity.

### P3 — Nice-to-have (only if the above is solid)

- **Dropzone "paste from clipboard"** (common Drive reflex).
- **Keyboard multi-select ranges** (shift+click already partially works via `lastClicked`; finish it).
- **Per-item metadata sidebar** (size, modified, path, hash on demand).
- **Deduplication check** on upload (server computes SHA-256 async; UI shows `Already uploaded` toast if hash matches an existing file and offers "keep both" or "skip").
- **Thumbnails for PDFs and videos** (first page, first frame). Requires `mupdf` or `ffmpeg` binary in the Docker image — optional, off by default, since the whole appeal is "no fat deps".
- **Server-sent events for upload progress** (replaces XHR progress), future consideration.

---

## 4. What to rip out (keep it minimal)

While we're adding things, also remove or simplify things that don't earn their keep:

- **CSRF rotation on every GET** (`middleware/csrf.go`): rotate at most once per session. Or go further — since all state-changing endpoints require a cookie auth and `SameSite=Strict`, CSRF is already essentially covered. Keep a single static session-scoped CSRF token to silence scanners; don't rotate it.
- **`Dashboard` server-side handler** (`internal/handlers/dashboard.go`): the SPA is the UI. The dashboard template + render pipeline is dead code from an earlier design. Delete it, along with `render.go` template cache for `dashboard` patterns. Keep `login.html` only if the login page still server-renders it (it doesn't — `Login` serves `web/static/dist/index.html`). Delete `web/templates/layout.html` and `login.html` too.
- **`html/template` dashboard components** in `web/templates/components/*.html` referenced by `Dashboard` — they aren't shipped; but the `RenderTemplate` call still hard-codes them. Purge.
- **`Dashboard` route in README** and anywhere else that refers to templates. The app is an SPA.
- **Double-filter** hidden/search in frontend (`pages/Dashboard.tsx`). The server already filters; just consume the response.
- **Unused `MultipartForm` 32 MB buffer** argument to `ParseMultipartForm` anywhere (once P0.1 lands).
- **Duplicate landing-page copy** (`landing-page/` inside the repo): moved to a separate branch or `docs/` site. Keeps the main repo focused.

---

## 5. Deployment and packaging cleanup

- `install.sh` must:
  - Generate a **fresh random bcrypt hash** at install time with a password it prints to the user once (and writes to a secure file the user is told to delete). Never bake `admin`.
  - Print the required post-install steps clearly.
  - Add an `--no-systemd` flag for users who prefer to manage it themselves.
- `Dockerfile`:
  - Add `ENV GOTMPDIR=/nodi_files/.cache/tmp`.
  - Add `RUN mkdir -p /nodi_files/.cache/tmp && chown -R nodi:nodi /nodi_files`.
  - Drop the `HEALTHCHECK` that hits `/api/health` — good as-is, keep.
  - Keep non-root `nodi` user, keep multi-stage.
- `run.sh`:
  - Refuse to start if the cookie secret is the hardcoded dev string (generate one if `.env` is missing; don't write the hardcoded value).
  - Add a `--no-build` flag so iterating on backend doesn't re-run Vite every time.
- Add a `nodi-cli` subcommand `./nodi adduser <name>` and `./nodi passwd <name>` for managing users/password from the CLI, so users don't have to run bcrypt in their head or edit env files.

---

## 6. Test plan

Current tests cover: small upload (11 bytes), download, rename, delete, traversal rejection, auth. They miss everything that matters. Add:

- `TestUpload_LargeFile_Streams`: POST a 200 MB body, assert peak RSS under 64 MB (using `runtime.MemStats`).
- `TestUpload_ExceedsMaxUpload_IsRejected`: `http.MaxBytesReader` returns the expected 400.
- `TestChunkUpload_Resume`: upload chunks 0,1,3 → call status → returns `received:[0,1,3]` → upload 2 → complete succeeds.
- `TestChunkUpload_RejectsTraversalFlowID`: `uploadId=../evil` → 400.
- `TestChunkComplete_RejectsTraversalFileName`: `fileName=../evil.txt` → 403.
- `TestServeShare_NoScriptInjection`: create a share of a folder containing `<script>`, GET the listing, assert the response does not contain an executable `<script>` tag (uses `html/template`).
- `TestServeShare_PasswordNotInURL`: password prompt form posts JSON to `/s/:token/unlock`; URL never carries the password.
- `TestChangePassword_RevokesSessions`: change password via API; old cookie returns 401 on the next request.
- `TestMoveRejectsOverwrite`: `move(a, b)` when `b` exists → 409.
- `TestTrashRestore_Collision`: delete two files with the same name at different paths; both restore correctly.
- `TestBackup_LargeTree_Streams`: walk 1 GB of generated files, assert the HTTP write starts within 5 s and memory stays bounded.

CI is already good (Go 1.24, `go vet`, race, lint, formatting, Trivy). Add one more job: `integration-large-upload` that runs the streaming upload test against a real `net.Pipe` server.

---

## 7. Priority ordering (what to do on Monday)

If I had one week I would do exactly this, in this order:

1. **P0.1** (streaming Upload) + **P0.4** (fix server timeouts). Verify by pushing a 10 GB file through a local test.
2. **P0.3** (compose profile). Without it, P0.1 still OOMs in Docker.
3. **P0.2** (chunk protocol + resume). Now 100 GB works across a flaky connection.
4. **P0.5** (path-traversal fixes across Restore, ChunkComplete, Favorite). Five small patches.
5. **P0.6** (ServeShare XSS + password flow). One handler rewrite.
6. **P0.7** (per-user session revocation + password change). Small but important.
7. **P0.8** (refuse unsafe defaults on boot).
8. **P1.1 + P1.2 + P1.3** (folder upload, bulk actions, folder download). Biggest UX jump.
9. **P1.4** (real drop-box shares).
10. **P1.5 / P1.6 / P1.7** (trash retention, thumb cache correctness, log rotation).
11. **P1.8** (Caddy compose + README section).

That is the MVP2. Ship it and it becomes recommendable.

P2 and P3 are there for later, when the first version has been running in your garage for a month without waking you up.

---

## 8. Sanity checks before release

A pre-flight list I'd run before telling anyone in the homelab community to try Nodi:

- [ ] `docker compose up` starts with defaults, no secret prompts. Login with printed temporary admin password.
- [ ] Upload a 20 GB file; pause Wi-Fi for 30 s mid-upload; resumes.
- [ ] Close the browser tab during upload; reopen the page; upload panel shows the resumable entry and finishes.
- [ ] Drag a 5 GB folder with 10k files onto the window; structure preserved on disk; progress accurate.
- [ ] Select 200 files, click Download; zip streams down, no OOM.
- [ ] Create a public share with password; open incognito; password works via POST form; URL never contains the password; right-click View Source → no unescaped filenames.
- [ ] Change admin password; other active browser session is logged out on next request.
- [ ] Pull the plug mid-upload; start server; `.cache/uploads` janitor cleans up; no phantom files in user dirs.
- [ ] Visit `/api/health` without auth: 200. Visit anything else without auth: 401/redirect.
- [ ] Run Trivy on the image: no HIGH/CRITICAL CVEs open.
- [ ] Run `gosec ./...` and `govulncheck ./...`: clean.
- [ ] Cookie secret default in `.env.example` is `CHANGE_ME_OR_SERVER_WILL_REFUSE_TO_START`, and the server does refuse.

When all of those pass on an old laptop with a 2 TB external drive, Nodi is ready to be the answer to "I want Drive, I don't want Nextcloud."
