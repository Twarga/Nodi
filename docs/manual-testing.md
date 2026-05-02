# Nodi — Manual Testing Guide

This guide walks you through testing every feature of Nodi in a web browser.

---

## 1. Start the Server

### Option A: Using Make (recommended)
```bash
make build    # Compiles CSS + Go binary
make run      # Builds and starts server
```

### Option B: Using run.sh
```bash
./run.sh          # Start once
./run.sh --watch  # Start with CSS hot-reload
```

### Option C: Direct
```bash
# 1. Compile Tailwind CSS
./tailwindcss-linux-x64 -i ./web/static/input.css -o ./web/static/output.css --minify

# 2. Run Go server
export QL_PORT=7319
export QL_ROOT=./data
export QL_USER=admin
export QL_PASS_HASH='$2b$10$giD/vH5ZWt26q8GEN0PdZejq/ZdpxdMci5bK4U2fnLHj1mfqZXmCy'
export QL_COOKIE_SECRET=local-dev-secret-keep-it-safe-1234567890123456
go run ./cmd/server
```

The server starts on `http://localhost:7319`.

---

## 2. Test Login Page

**URL:** `http://localhost:7319/login`

### What to check:
- [ ] Page loads with Nodi logo, "Sign in to your server" text
- [ ] Theme toggle button (top-right) works — cycles System → Light → Dark → System
- [ ] In dark mode, the page background turns dark navy
- [ ] Enter wrong password → "Invalid credentials" error (no username leak)
- [ ] Enter `admin` / `admin` → redirects to dashboard
- [ ] After login, a `ql_session` cookie exists (DevTools → Application → Cookies)
- [ ] A `ql_csrf` cookie also exists (CSRF protection)

---

## 3. Test Dashboard

**URL:** `http://localhost:7319/`

### What to check:
- [ ] TopBar shows Nodi logo + username initial pill (e.g., "A" for admin)
- [ ] Theme toggle button works (same as login page)
- [ ] Click user pill → dropdown shows "Signed in as admin", About v1.0, Logout
- [ ] Click Logout → redirects back to login page
- [ ] `ql_session` cookie is cleared after logout

---

## 4. Test File Browsing

### What to check:
- [ ] Empty folder shows message or empty state
- [ ] Create a folder via "New Folder" button → appears in list
- [ ] Breadcrumb updates when navigating into folder
- [ ] Click breadcrumb to go back up
- [ ] List view / Grid view toggle works (persists after refresh)
- [ ] Files show correct icon (folder, image, video, file)

---

## 5. Test Upload

### What to check:
- [ ] Click "Upload" button → file picker opens
- [ ] Select files → upload progress appears
- [ ] Drag files onto the page → drop overlay appears, upload works
- [ ] Uploaded files appear in the file list
- [ ] Try uploading same filename twice → should show overwrite or error (T69 not done yet)

---

## 6. Test File Actions

### What to check:
- [ ] Click `...` on a file → context menu opens (Rename, Download, Delete)
- [ ] Rename a file → name updates without page reload
- [ ] Download a file → browser downloads it
- [ ] Delete a file → confirmation modal, then file disappears
- [ ] Select multiple files (checkboxes) → bulk delete works

---

## 7. Test CSRF Protection (Security)

### What to check:
1. Open DevTools → Network tab
2. Perform any action (create folder, delete, rename, upload)
3. Check the request headers:
   - [ ] `X-CSRF-Token` header is present
   - [ ] `ql_csrf` cookie is sent with the request
4. Try a malicious request in browser console:
   ```javascript
   fetch('/api/delete', {
     method: 'POST',
     headers: {'Content-Type': 'application/json'},
     body: JSON.stringify({path: '/test.txt'})
   })
   ```
   - [ ] Should return **403 Forbidden** (CSRF token missing)

---

## 8. Test Health & API Endpoints

```bash
# No auth required
curl http://localhost:7319/api/health
curl http://localhost:7319/api/version
curl http://localhost:7319/api/metrics

# Should return JSON responses
```

---

## 9. Test Path Traversal Protection

### What to check:
- [ ] Try accessing `/browse?path=../../etc` → should return 400/403
- [ ] Try creating folder with name `../escape` → should fail
- [ ] Try deleting `/` (root) → should fail

---

## 10. Test Rate Limiting

### What to check:
- [ ] Rapidly click login with wrong password 6+ times
- [ ] 6th+ request should return **429 Too Many Requests**
- [ ] Wait 15 minutes → limit resets

---

## 11. Browser Console Checks

Open DevTools → Console and verify:
- [ ] No JavaScript errors on page load
- [ ] No 404 errors for static assets (icons.svg, output.css, app.js)
- [ ] Theme toggle logs or works without errors
- [ ] File actions (rename, delete) show success toasts

---

## 12. Responsive Design

### What to check:
- [ ] Resize browser to mobile width (< 768px)
- [ ] Layout adapts (sidebar collapses, buttons stack)
- [ ] Touch targets are large enough

---

## Quick Test Checklist (copy/paste)

| Feature | How to Test | Expected Result |
|---------|-------------|-----------------|
| Login | `admin`/`admin` | Redirects to dashboard |
| Wrong password | Wrong pass | "Invalid credentials" |
| Theme toggle | Click sun/moon icon | Page changes color scheme |
| CSRF protection | Missing X-CSRF-Token header | 403 Forbidden |
| Create folder | "New Folder" button | Folder appears in list |
| Upload | Drag file or click Upload | File appears, progress shows |
| Rename | `...` → Rename | Name updates inline |
| Delete | `...` → Delete | Confirmation modal, file gone |
| Bulk delete | Checkboxes + "Delete Selected" | Multiple files deleted |
| Download | `...` → Download | Browser downloads file |
| Logout | User pill → Logout | Redirects to login |
| Path traversal | `?path=../../etc` | 403 or 400 error |
| Rate limit | 6 failed logins | 429 Too Many Requests |
| Health endpoint | `GET /api/health` | JSON with status: ok |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "template parsing error" | Make sure you're running from repo root |
| "connection refused" | Check if server is running on port 7319 |
| "invalid credentials" | Verify `QL_PASS_HASH` matches password "admin" |
| "500 Internal Server Error" | Check server logs in terminal |
| Missing icons | Verify `icons.svg` exists in `web/static/` |
| CSS not loading | Run `./run.sh` or `make css` to compile Tailwind |

---

## Automated Tests (run these too)

```bash
# Run all tests
go test ./... -count=1

# Run with race detection
go test -race ./...

# Run integration test only
go test -v ./cmd/server -run TestFileManagerEndToEnd
```