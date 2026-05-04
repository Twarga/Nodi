# Round 3 — Optional: Public Shares, Activity Log, Backup/Restore

**Goal:** Features that make Nodi useful for sharing files with others and operating it long-term. Strictly optional — Rounds 1+2 already give you a deployable single-user file manager.

**Estimated effort:** ~3–4 hours. Tackle one section at a time and commit between sections.

**Pre-req:** Rounds 1 & 2 complete and committed.

---

## Section A — Public Share Links (~1.5 hr)

Generate a URL like `/s/abc123` that exposes a single file or folder to the public, optionally with a password and an expiry.

### A1. Share storage format

We use a JSON file at `<QL_ROOT>/.nodishare.json`. Each entry:

```json
{
  "token": "8ZKv3qLpMnXyQ7r2",
  "path": "/Documents/report.pdf",
  "is_dir": false,
  "created_at": "2026-05-04T10:30:00Z",
  "expires_at": "2026-05-11T10:30:00Z",
  "password_hash": "",
  "mode": "read"
}
```

`mode` is `"read"` for download-only, `"upload"` for drop-zone (folder shares only). `password_hash` is bcrypt or empty.

### A2. Backend

**File (new):** `internal/handlers/shares.go`

Implement these handlers (signatures only — fill in following the patterns in `internal/handlers/files.go`):

```go
// POST /api/share  body: {path, expires_at?, password?, mode}
// Generates random 16-char token, persists to .nodishare.json, returns {token, url}
func CreateShare(cfg *config.Config) http.HandlerFunc

// GET /api/share — lists shares owned by this user
func ListShares(cfg *config.Config) http.HandlerFunc

// DELETE /api/share?token=...
func RevokeShare(cfg *config.Config) http.HandlerFunc

// GET /s/{token}  — public, no auth
//   - load .nodishare.json, find token
//   - if expired, 410 Gone
//   - if password set, render password prompt or check ?password= query
//   - if file: serve content with attachment Content-Disposition
//   - if dir: render simple HTML listing with download links to nested resources via /s/{token}/path
func ServeShare(cfg *config.Config) http.HandlerFunc
```

**Concrete implementation guide:**

Use these helpers from existing code:
- `crypto/rand` for token generation:
  ```go
  func newShareToken() string {
      b := make([]byte, 12)
      rand.Read(b)
      return base64.RawURLEncoding.EncodeToString(b) // 16 chars
  }
  ```
- `os.OpenFile` with `O_APPEND` won't work for JSON — read full file, modify slice, atomic write. Mirror the pattern in `internal/handlers/favorite.go` if it exists, or use the same `UpdateEnvFile` atomic-rename pattern from Round 2.
- For dir sharing, restrict path traversal: when serving `/s/{token}/sub/path`, join `share.path` and `sub/path`, then `filepath.Clean`, then verify result has prefix `share.path` (else 403).

### A3. Routes

**File:** `cmd/server/main.go`, after the storage handler line:

```go
mux.Handle("/api/share", middleware.AuthRequired(cfg.CookieSecret)(handlers.SharesRouter(cfg)))
mux.Handle("/s/", http.StripPrefix("/s/", handlers.ServeShare(cfg)))
```

`SharesRouter` is a tiny handler that dispatches POST/GET/DELETE to the three internal handlers above.

### A4. Frontend

**File:** `web/app/src/lib/api.ts` — add:

```ts
export interface Share {
  token: string;
  path: string;
  is_dir: boolean;
  created_at: string;
  expires_at: string | null;
  has_password: boolean;
  mode: 'read' | 'upload';
  url: string;
}

export const shareAPI = {
  list: () => fetchJSON<Share[]>('/api/share'),
  create: (params: { path: string; expires_at?: string; password?: string; mode: 'read' | 'upload' }) =>
    fetchJSON<Share>('/api/share', { method: 'POST', body: JSON.stringify(params) }),
  revoke: (token: string) =>
    fetchJSON<void>(`/api/share?token=${encodeURIComponent(token)}`, { method: 'DELETE' }),
};
```

**File (new):** `web/app/src/components/ShareModal.tsx`

A modal that takes `file: FileInfo` and `path: string`, calls `shareAPI.create`, and shows the resulting URL with a "Copy" button. Also lists existing shares with revoke buttons. Pattern after the existing `Modal` + `FolderPicker` components.

**Wire it:** Add a `Share…` action to `ContextMenu.tsx`. Pass an `onShare` handler from `Dashboard.tsx` that opens the share modal. Mirror the existing `onMove`/`onCopy` pattern.

### A5. Verify

- Right-click a file → "Share…" → modal opens.
- Submit with no password, no expiry → URL appears, copy works.
- Open URL in incognito → file downloads (no auth required).
- Add password → URL prompts for password before serving.
- Add 1-minute expiry → wait, then URL returns 410.
- Revoke share → URL returns 404.

---

## Section B — Activity Log (~45 min)

Append-only log of mutations. Useful for audit and debugging.

### B1. Backend logger

**File (new):** `internal/storage/activity.go`

```go
package storage

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type ActivityEvent struct {
	At     time.Time `json:"at"`
	User   string    `json:"user"`
	Action string    `json:"action"` // "upload" | "delete" | "rename" | "move" | "copy" | "share.create" | "share.revoke"
	Path   string    `json:"path"`
	Extra  string    `json:"extra,omitempty"`
}

var activityMu sync.Mutex

// Append writes one JSON line to <root>/.nodilog.jsonl.
// Failures are silently ignored — logging must never break a request.
func Append(root string, ev ActivityEvent) {
	activityMu.Lock()
	defer activityMu.Unlock()
	if ev.At.IsZero() {
		ev.At = time.Now().UTC()
	}
	logPath := filepath.Join(root, ".nodilog.jsonl")
	f, err := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
	if err != nil {
		return
	}
	defer f.Close()
	enc := json.NewEncoder(f)
	enc.Encode(ev)
}
```

### B2. Hook into mutation handlers

In each mutation handler (`Upload`, `Delete`, `Rename`, `Move`, `Copy`, `Duplicate`, `CreateFolder`, `CreateFile`, `Restore`, share create/revoke), after the operation succeeds, add:

```go
storage.Append(cfg.Root, storage.ActivityEvent{
    User:   sessionUserFromCtx(r.Context()),
    Action: "rename", // adjust per handler
    Path:   targetPath,
})
```

Where `sessionUserFromCtx` pulls the user from the auth middleware context (look at how `Whoami()` does it in `spa.go`).

### B3. Read endpoint

**File:** `internal/handlers/stats.go` (or new file). Add:

```go
// GET /api/activity?limit=100 — returns last N events newest first
func Activity(cfg *config.Config) http.HandlerFunc { /* read .nodilog.jsonl, parse lines, reverse, slice, return JSON */ }
```

Register: `mux.Handle("/api/activity", middleware.AuthRequired(cfg.CookieSecret)(handlers.Activity(cfg)))`

### B4. Frontend

Add a fourth card to the Settings page: "Recent activity". Calls `/api/activity?limit=50`, renders a table:

```
2026-05-04 10:30:42  upload   admin  /report.pdf
2026-05-04 10:29:15  delete   admin  /old/notes.txt
```

---

## Section C — Backup & Restore (~1 hr)

### C1. Backup endpoint

**File:** new handler `Backup(cfg)`:

```go
// GET /api/backup — streams entire QL_ROOT as a ZIP
// Skip .trash, .cache, .nodifav.json, .nodishare.json, .nodilog.jsonl
//   (configurable, but these are noise)
// Set Content-Disposition: attachment; filename="nodi-backup-2026-05-04.zip"
// Use archive/zip writer with deflate
```

Pattern after the existing `Compress` handler in `files.go` — same streaming approach.

### C2. Restore endpoint

```go
// POST /api/restore-backup  multipart upload of a ZIP
// Validate the ZIP entry by entry (no zip slip, max size)
// Extract into QL_ROOT (merge — overwrites existing files; does not delete)
// Use a temp dir; rename atomically only if all entries extract cleanly
```

This one is **dangerous** — get it wrong and you lose data. Build it last, and put a "Type DELETE to confirm" check on the frontend. Skip if you do not have time to test thoroughly.

### C3. Frontend

Add a "Backup" card to Settings:

- **Download backup** button → `window.location = '/api/backup'`. Will stream the ZIP.
- **Restore from file** input. On submit, POSTs the file and shows progress. Confirmation dialog with the `Type DELETE to confirm` pattern.

---

## Cross-cutting verification

After each section, run:

```bash
cd /home/twarga/Nodi/web/app && npm run build
cd /home/twarga/Nodi && go build ./... && go test ./...
```

All tests must pass. If a Go test fails, fix it before moving on — likely you forgot to update an interface or a route registration changed.

---

## What we are deliberately NOT doing in Round 3

- **Multi-user / signups / roles.** Single-user is fine for self-hosting. Adding multi-user requires a real database and user management UI — that is a separate project.
- **OAuth / SSO.** Same reason.
- **End-to-end encryption.** Out of scope.
- **WebDAV / FTP / S3 protocols.** This is a web app, not a protocol gateway.

If the user later wants any of these, treat them as new top-level projects, not bug fixes.

---

## Final commit

```bash
git add -A
git commit -m "Round 3: Public shares, activity log, backup/restore"
```

Push to your server, deploy, and you're done.
