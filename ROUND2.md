# Round 2 — Settings Page, Storage Usage, Password Change

**Goal:** A real `/settings` page. Storage usage bar (real `du` of `QL_ROOT`). Password change flow that persists to disk. Version info.

**Estimated effort:** ~2.5 hours.

**Pre-req:** Round 1 must be complete and committed.

---

## Architecture decision (read once)

- **Single-user app.** There is one `QL_USER` and one `QL_PASS_HASH` in `.env`. We are not adding multi-user. Password change rewrites the `.env` file in place (atomic write to a temp file then rename).
- **Storage usage** = recursive sum of file sizes under `QL_ROOT`, plus `os.Statfs` for free/total disk space. Cache for 30s to avoid recomputing on every page load.
- **Settings route** is `/settings`. Already supported by `web/app/src/lib/router.ts` (the `'settings'` route exists).
- **Backend route** for SPA: when user navigates to `/settings` directly (e.g. refresh), Go must serve `web/static/dist/index.html` for that path too.

---

## Step 1 — Backend: Storage usage endpoint

### 1a. Create the storage stats handler

**File (new):** `internal/handlers/stats.go`

```go
package handlers

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"syscall"
	"time"

	"github.com/Twarga/Nodi/internal/config"
)

type storageStats struct {
	Used      int64 `json:"used"`       // bytes used by files under QL_ROOT
	Total     int64 `json:"total"`      // total bytes on the filesystem
	Free      int64 `json:"free"`       // free bytes on the filesystem
	FileCount int64 `json:"file_count"` // number of regular files under QL_ROOT
	DirCount  int64 `json:"dir_count"`  // number of directories under QL_ROOT
}

var (
	statsCache    storageStats
	statsCacheAt  time.Time
	statsCacheMu  sync.Mutex
	statsCacheTTL = 30 * time.Second
)

func computeStorage(root string) (storageStats, error) {
	var s storageStats

	err := filepath.WalkDir(root, func(_ string, d os.DirEntry, err error) error {
		if err != nil {
			return nil // skip unreadable entries; do not abort
		}
		if d.IsDir() {
			s.DirCount++
			return nil
		}
		info, err := d.Info()
		if err != nil {
			return nil
		}
		s.Used += info.Size()
		s.FileCount++
		return nil
	})
	if err != nil {
		return s, err
	}

	var fs syscall.Statfs_t
	if err := syscall.Statfs(root, &fs); err == nil {
		s.Total = int64(fs.Blocks) * int64(fs.Bsize)
		s.Free = int64(fs.Bavail) * int64(fs.Bsize)
	}
	return s, nil
}

func StorageStats(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		statsCacheMu.Lock()
		fresh := time.Since(statsCacheAt) < statsCacheTTL
		cached := statsCache
		statsCacheMu.Unlock()

		if fresh {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(cached)
			return
		}

		s, err := computeStorage(cfg.Root)
		if err != nil {
			http.Error(w, "failed to compute storage", http.StatusInternalServerError)
			return
		}

		statsCacheMu.Lock()
		statsCache = s
		statsCacheAt = time.Now()
		statsCacheMu.Unlock()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(s)
	}
}
```

### 1b. Register the route

**File:** `cmd/server/main.go`

Find this block (around line 138, the rename API registration):

```go
mux.Handle("/api/rename", middleware.AuthRequired(cfg.CookieSecret)(handlers.Rename(cfg)))
```

Add immediately **after** it:

```go
mux.Handle("/api/storage", middleware.AuthRequired(cfg.CookieSecret)(handlers.StorageStats(cfg)))
```

### 1c. Verify

```bash
go build ./...
```

Must succeed.

---

## Step 2 — Backend: Password change endpoint

### 2a. Helper to rewrite the .env file safely

**File (new):** `internal/config/envfile.go`

```go
package config

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// UpdateEnvFile rewrites .env so that the given key has the given value.
// If the key does not exist, it is appended. The write is atomic
// (write to .env.tmp then rename). Other lines are preserved verbatim.
//
// envPath is typically ".env". Caller must ensure permissions are correct
// after the rename (we copy the original mode if available).
func UpdateEnvFile(envPath, key, value string) error {
	abs, err := filepath.Abs(envPath)
	if err != nil {
		return err
	}

	// Read existing lines (if file exists).
	var lines []string
	mode := os.FileMode(0600)
	if info, err := os.Stat(abs); err == nil {
		mode = info.Mode().Perm()
		f, err := os.Open(abs)
		if err != nil {
			return err
		}
		scanner := bufio.NewScanner(f)
		// allow long lines (bcrypt hashes)
		scanner.Buffer(make([]byte, 1024*1024), 1024*1024)
		for scanner.Scan() {
			lines = append(lines, scanner.Text())
		}
		f.Close()
		if err := scanner.Err(); err != nil {
			return err
		}
	}

	prefix := key + "="
	replaced := false
	for i, line := range lines {
		trim := strings.TrimSpace(line)
		if strings.HasPrefix(trim, "#") {
			continue
		}
		if strings.HasPrefix(trim, prefix) {
			lines[i] = fmt.Sprintf("%s=%s", key, value)
			replaced = true
		}
	}
	if !replaced {
		lines = append(lines, fmt.Sprintf("%s=%s", key, value))
	}

	tmp := abs + ".tmp"
	out, err := os.OpenFile(tmp, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, mode)
	if err != nil {
		return err
	}
	w := bufio.NewWriter(out)
	for _, line := range lines {
		if _, err := w.WriteString(line + "\n"); err != nil {
			out.Close()
			os.Remove(tmp)
			return err
		}
	}
	if err := w.Flush(); err != nil {
		out.Close()
		os.Remove(tmp)
		return err
	}
	if err := out.Close(); err != nil {
		os.Remove(tmp)
		return err
	}
	return os.Rename(tmp, abs)
}
```

### 2b. Password change handler

**File (new):** `internal/handlers/password.go`

```go
package handlers

import (
	"encoding/json"
	"net/http"
	"os"

	"github.com/Twarga/Nodi/internal/config"
	"golang.org/x/crypto/bcrypt"
)

type passwordChangeRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

// ChangePassword verifies the current password, hashes the new one,
// rewrites .env, and updates the in-memory cfg.PassHash.
//
// All sessions remain valid; the user can roll their session by hitting
// logout (server already rotates cookie secret on logout — T67).
func ChangePassword(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req passwordChangeRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		if len(req.NewPassword) < 8 {
			http.Error(w, "new password must be at least 8 characters", http.StatusBadRequest)
			return
		}

		if err := bcrypt.CompareHashAndPassword([]byte(cfg.PassHash), []byte(req.CurrentPassword)); err != nil {
			http.Error(w, "current password is incorrect", http.StatusUnauthorized)
			return
		}

		newHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
		if err != nil {
			http.Error(w, "failed to hash password", http.StatusInternalServerError)
			return
		}

		envPath := os.Getenv("QL_ENV_FILE")
		if envPath == "" {
			envPath = ".env"
		}
		if err := config.UpdateEnvFile(envPath, "QL_PASS_HASH", string(newHash)); err != nil {
			http.Error(w, "failed to persist password: "+err.Error(), http.StatusInternalServerError)
			return
		}

		cfg.PassHash = string(newHash)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]bool{"success": true})
	}
}
```

### 2c. Register the route

**File:** `cmd/server/main.go`

Right after the `/api/storage` line you just added:

```go
mux.Handle("/api/password", middleware.AuthRequired(cfg.CookieSecret)(handlers.ChangePassword(cfg)))
```

### 2d. Verify

```bash
go build ./...
```

Must succeed.

---

## Step 3 — Backend: Make `/settings` resolve to SPA

The SPA handler currently catches `/`. When the user refreshes on `/settings`, Go also needs to serve the SPA shell.

**File:** `cmd/server/main.go`

The current handler registration is:
```go
mux.Handle("/", middleware.AuthRequired(cfg.CookieSecret)(handlers.SPA()))
```

Because `/` is a catch-all in `http.ServeMux`, refreshes on `/settings` already fall through to the SPA handler, **unless** another handler is registered for that path. Verify there isn't one:

```bash
grep -n '"/settings"' cmd/server/main.go
```

If there's no match, you're done — `/` will catch `/settings`. Skip to Step 4.

If a match exists, remove it.

---

## Step 4 — Frontend: API client additions

**File:** `web/app/src/lib/api.ts`

Add these new exports at the bottom of the file (after `trashAPI`):

```ts
// ─── Storage ─────────────────────────────────────────
export interface StorageStats {
  used: number;
  total: number;
  free: number;
  file_count: number;
  dir_count: number;
}

export const storageAPI = {
  stats: () => fetchJSON<StorageStats>('/api/storage'),
};

// ─── Password ────────────────────────────────────────
export const passwordAPI = {
  change: (currentPassword: string, newPassword: string) =>
    fetchJSON<{ success: boolean }>('/api/password', {
      method: 'POST',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    }),
};

// ─── Version ─────────────────────────────────────────
export interface VersionInfo {
  version: string;
  go_version: string;
}

export const versionAPI = {
  get: () => fetchJSON<VersionInfo>('/api/version'),
};
```

---

## Step 5 — Frontend: Settings page

**File (new):** `web/app/src/pages/Settings.tsx`

```tsx
import { useEffect, useState } from 'preact/hooks';
import { storageAPI, passwordAPI, versionAPI } from '../lib/api';
import type { StorageStats, VersionInfo } from '../lib/api';
import { TopBar } from '../components/TopBar';
import { toast, ToastContainer } from '../hooks/useToast';
import { navigate } from '../lib/router';

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

export function SettingsPage() {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [version, setVersion] = useState<VersionInfo | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    storageAPI.stats()
      .then(setStats)
      .catch(() => toast('Failed to load storage stats', 'error'))
      .finally(() => setStatsLoading(false));
    versionAPI.get().then(setVersion).catch(() => {});
  }, []);

  const submitPassword = async (e: Event) => {
    e.preventDefault();
    if (next.length < 8) {
      toast('New password must be at least 8 characters', 'error');
      return;
    }
    if (next !== confirm) {
      toast('Passwords do not match', 'error');
      return;
    }
    setPwLoading(true);
    try {
      await passwordAPI.change(current, next);
      toast('Password updated', 'success');
      setCurrent(''); setNext(''); setConfirm('');
    } catch (err) {
      toast((err as Error).message || 'Failed to change password', 'error');
    } finally {
      setPwLoading(false);
    }
  };

  const usedPercent = stats && stats.total > 0
    ? Math.min(100, (stats.used / stats.total) * 100)
    : 0;

  return (
    <div class="flex h-screen flex-col overflow-hidden bg-background">
      <TopBar />
      <main class="flex-1 overflow-y-auto">
        <div class="px-4 sm:px-6 lg:px-8 pt-6 pb-12 mx-auto max-w-3xl">
          <div class="mb-6 flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              class="icon-button h-9 w-9"
              title="Back to files"
              aria-label="Back to files"
            >
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="19" y1="12" x2="5" y2="12"/>
                <polyline points="12 19 5 12 12 5"/>
              </svg>
            </button>
            <h1 class="text-2xl font-bold tracking-tight">Settings</h1>
          </div>

          {/* Storage card */}
          <section class="rounded-2xl border border-border bg-surface p-6 mb-6">
            <h2 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Storage</h2>
            {statsLoading ? (
              <div class="h-20 animate-pulse rounded-lg bg-muted/50" />
            ) : stats ? (
              <>
                <div class="flex items-baseline justify-between mb-2">
                  <div class="text-2xl font-bold">{formatBytes(stats.used)}</div>
                  <div class="text-sm text-muted-foreground">
                    of {formatBytes(stats.total)} ({formatBytes(stats.free)} free)
                  </div>
                </div>
                <div class="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    class="h-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all duration-500"
                    style={`width: ${usedPercent.toFixed(1)}%`}
                  />
                </div>
                <div class="mt-4 flex gap-6 text-xs text-muted-foreground">
                  <div><span class="font-semibold text-foreground">{stats.file_count.toLocaleString()}</span> files</div>
                  <div><span class="font-semibold text-foreground">{stats.dir_count.toLocaleString()}</span> folders</div>
                </div>
              </>
            ) : (
              <p class="text-sm text-muted-foreground">Storage stats unavailable.</p>
            )}
          </section>

          {/* Password card */}
          <section class="rounded-2xl border border-border bg-surface p-6 mb-6">
            <h2 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Change Password</h2>
            <form onSubmit={submitPassword} class="space-y-4">
              <div>
                <label class="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current password</label>
                <input
                  type="password" value={current} required
                  onInput={(e) => setCurrent((e.target as HTMLInputElement).value)}
                  class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  autoComplete="current-password"
                />
              </div>
              <div>
                <label class="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">New password</label>
                <input
                  type="password" value={next} required minLength={8}
                  onInput={(e) => setNext((e.target as HTMLInputElement).value)}
                  class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  autoComplete="new-password"
                />
                <p class="mt-1 text-xs text-muted-foreground">Minimum 8 characters.</p>
              </div>
              <div>
                <label class="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Confirm new password</label>
                <input
                  type="password" value={confirm} required
                  onInput={(e) => setConfirm((e.target as HTMLInputElement).value)}
                  class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  autoComplete="new-password"
                />
              </div>
              <button
                type="submit"
                disabled={pwLoading || !current || !next || !confirm}
                class="command-button primary h-10 px-4 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pwLoading ? 'Updating...' : 'Update password'}
              </button>
            </form>
          </section>

          {/* About card */}
          <section class="rounded-2xl border border-border bg-surface p-6">
            <h2 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">About</h2>
            <dl class="space-y-2 text-sm">
              <div class="flex justify-between">
                <dt class="text-muted-foreground">Version</dt>
                <dd class="font-mono">{version?.version ?? '—'}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-muted-foreground">Runtime</dt>
                <dd class="font-mono">Go {version?.go_version ?? '—'}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-muted-foreground">Project</dt>
                <dd>Nodi · Self-hosted file manager</dd>
              </div>
            </dl>
          </section>
        </div>
      </main>
      <ToastContainer />
    </div>
  );
}
```

---

## Step 6 — Wire route into App

**File:** `web/app/src/App.tsx`

Replace the entire file with:

```tsx
import { AuthProvider, useAuth } from './stores/auth';
import { ThemeProvider } from './stores/theme';
import { useRoute } from './lib/router';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { SettingsPage } from './pages/Settings';

function Router() {
  const route = useRoute();
  const { state } = useAuth();

  if (state.value.loading) {
    return (
      <div class="flex h-screen items-center justify-center">
        <svg class="h-8 w-8 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
      </div>
    );
  }

  if (route.value === 'login') {
    if (state.value.user) {
      window.history.replaceState({}, '', '/');
      route.value = 'dashboard';
      return <DashboardPage />;
    }
    return <LoginPage />;
  }

  if (!state.value.user) {
    window.location.href = '/login';
    return null;
  }

  if (route.value === 'settings') return <SettingsPage />;
  return <DashboardPage />;
}

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router />
      </AuthProvider>
    </ThemeProvider>
  );
}
```

---

## Step 7 — TopBar dropdown: add Settings link

**File:** `web/app/src/components/TopBar.tsx`

Add at the top with other imports:

```tsx
import { navigate } from '../lib/router';
```

Find the dropdown panel (the JSX with "Signed in as" header). Inside the `<div class="p-1">` wrapper, **before** the `Sign out` button, insert:

```tsx
<button
  onClick={() => { setDropdownOpen(false); navigate('/settings'); }}
  class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-surface-hover"
>
  <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
  Settings
</button>
```

---

## Step 8 — Build & Verify

```bash
cd /home/twarga/Nodi/web/app && npm run build
cd /home/twarga/Nodi && go build ./...
```

Both must succeed.

### Manual smoke test

```bash
./run.sh
```

Open http://localhost:7319, log in, then:

- [ ] Click avatar → dropdown shows "Settings" above "Sign out".
- [ ] Click "Settings" → URL changes to `/settings`, page loads with three cards.
- [ ] Storage card shows real numbers (used / total / free), file count, folder count, gradient bar.
- [ ] Refresh on `/settings` → page reloads correctly (no 404).
- [ ] Change password with wrong current → toast "current password is incorrect".
- [ ] Change password with mismatched confirm → toast "Passwords do not match".
- [ ] Change password with valid input → toast "Password updated". Verify by:
  - Sign out.
  - Sign in with the **new** password — should succeed.
  - Inspect `.env` — `QL_PASS_HASH=` line should have a new hash.

If all pass, commit:

```bash
git add -A
git commit -m "Round 2: Settings page, storage stats, password change"
```

---

## Notes / gotchas

- **`.env` permissions** — make sure `.env` is owned by the user running the Go process and is `0600`. The atomic write preserves the original mode.
- **Production deploys with read-only filesystem** — if `.env` lives in a read-only mount, password change will fail with a 500. That's expected; the user can still set `QL_PASS_HASH` via env directly. The error message surfaced to the UI is clear.
- **Storage cache TTL** — 30 seconds. If you want it tighter, change `statsCacheTTL` in `internal/handlers/stats.go`. For very large directories the WalkDir takes seconds; the cache prevents this from blocking every page load.
