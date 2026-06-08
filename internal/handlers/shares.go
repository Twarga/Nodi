package handlers

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/Twarga/Nodi/internal/auth"
	"github.com/Twarga/Nodi/internal/config"
	"github.com/Twarga/Nodi/internal/middleware"
	"github.com/Twarga/Nodi/internal/storage"
	"golang.org/x/crypto/bcrypt"
)

// parseShareExpiry accepts multiple timestamp formats that the UI may send.
// Strict mode is RFC3339 (e.g. "2026-12-25T15:30:00Z"). Defensive fallbacks
// cover the browser <input type="datetime-local"> shape (no timezone) so
// expiry does not silently fail when the client forgets to convert.
func parseShareExpiry(value string) (time.Time, error) {
	if value == "" {
		return time.Time{}, fmt.Errorf("empty expiry")
	}
	layouts := []string{
		time.RFC3339,
		time.RFC3339Nano,
		"2006-01-02T15:04:05",
		"2006-01-02T15:04",
		"2006-01-02 15:04:05",
		"2006-01-02 15:04",
	}
	for _, layout := range layouts {
		if t, err := time.Parse(layout, value); err == nil {
			if layout == time.RFC3339 || layout == time.RFC3339Nano {
				return t.UTC(), nil
			}
			return t.UTC(), nil
		}
	}
	return time.Time{}, fmt.Errorf("unrecognized expiry format: %q", value)
}

type shareEntry struct {
	Token        string `json:"token,omitempty"`
	TokenHash    string `json:"token_hash,omitempty"`
	Path         string `json:"path"`
	IsDir        bool   `json:"is_dir"`
	CreatedAt    string `json:"created_at"`
	CreatedBy    string `json:"created_by,omitempty"`
	ExpiresAt    string `json:"expires_at"`
	PasswordHash string `json:"password_hash"`
	Mode         string `json:"mode"`
	MaxFileSize  int64  `json:"max_file_size,omitempty"`
	MaxFileCount int    `json:"max_file_count,omitempty"`
}

type shareFile struct {
	Shares []shareEntry `json:"shares"`
}

type shareListItem struct {
	Name  string
	URL   string
	IsDir bool
}

type shareListPage struct {
	Token   string
	Title   string
	Parent  string
	Entries []shareListItem
}

var sharePasswordTemplate = template.Must(template.New("share-password").Parse(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Share - Password Required</title>
  <style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f8f9fa;color:#111827}form{background:#fff;padding:2rem;border-radius:12px;box-shadow:0 8px 28px rgba(15,23,42,.12);width:min(92vw,360px)}input{padding:.65rem;border:1px solid #cbd5e1;border-radius:8px;width:100%;box-sizing:border-box}button{margin-top:1rem;padding:.65rem 1.25rem;background:#0891b2;color:#fff;border:none;border-radius:8px;cursor:pointer;width:100%;font-weight:700}.error{color:#dc2626;font-size:.875rem}</style>
</head>
<body>
  <form method="post" action="/s/{{.Token}}/unlock">
    <h2>Password Required</h2>
    {{if .Error}}<p class="error">{{.Error}}</p>{{end}}
    <input type="password" name="password" placeholder="Enter password" autofocus required>
    <button type="submit">Access share</button>
  </form>
</body>
</html>`))

var shareDirectoryTemplate = template.Must(template.New("share-directory").Parse(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{.Title}}</title>
  <style>body{font-family:sans-serif;max-width:860px;margin:2rem auto;padding:0 1rem;color:#0f172a}a{display:block;padding:.7rem .85rem;border-bottom:1px solid #e2e8f0;color:#0369a1;text-decoration:none;word-break:break-word}a:hover{background:#f0f9ff}.dir{font-weight:700}h1{font-size:1.35rem}</style>
</head>
<body>
  <h1>{{.Title}}</h1>
  {{if .Parent}}<a href="{{.Parent}}" class="dir">..</a>{{end}}
  {{range .Entries}}
    <a href="{{.URL}}" class="{{if .IsDir}}dir{{end}}">{{.Name}}{{if .IsDir}}/{{end}}</a>
  {{else}}
    <p>This shared folder is empty.</p>
  {{end}}
</body>
</html>`))

var shareDropboxTemplate = template.Must(template.New("share-dropbox").Parse(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Upload to Shared Folder</title>
  <style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f8fafc;color:#0f172a;padding:1rem}.card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;box-shadow:0 10px 30px rgba(15,23,42,.1);padding:1.5rem;width:min(92vw,460px)}input{width:100%;box-sizing:border-box;margin-top:.75rem}button{margin-top:1rem;padding:.75rem 1.2rem;background:#0891b2;color:#fff;border:0;border-radius:10px;font-weight:700;width:100%;cursor:pointer}.hint{color:#64748b;font-size:.9rem;line-height:1.45}.ok{color:#15803d;font-size:.9rem}</style>
</head>
<body>
  <div class="card">
    <h1>Upload files</h1>
    <p class="hint">Files uploaded here will be sent directly into the shared folder. Existing files are not overwritten.</p>
    {{if .Message}}<p class="ok">{{.Message}}</p>{{end}}
    <form method="post" action="/s/{{.Token}}/upload" enctype="multipart/form-data">
      <input type="file" name="files" multiple required>
      <button type="submit">Upload</button>
    </form>
  </div>
</body>
</html>`))

func newShareToken() string {
	b := make([]byte, 32)
	rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

func shareTokenHash(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func normalizeShareForStorage(s shareEntry) shareEntry {
	if s.TokenHash == "" && s.Token != "" {
		s.TokenHash = shareTokenHash(s.Token)
	}
	s.Token = ""
	return s
}

func shareMatchesToken(s shareEntry, token string) bool {
	if token == "" {
		return false
	}
	if s.Token != "" && hmac.Equal([]byte(s.Token), []byte(token)) {
		return true
	}
	if s.TokenHash != "" {
		if hmac.Equal([]byte(s.TokenHash), []byte(token)) {
			return true
		}
		return hmac.Equal([]byte(s.TokenHash), []byte(shareTokenHash(token)))
	}
	return false
}

func shareReference(s shareEntry) string {
	if s.Token != "" {
		return s.Token
	}
	return s.TokenHash
}

func sharePublicURL(s shareEntry) string {
	if s.Token == "" {
		return ""
	}
	return fmt.Sprintf("/s/%s", s.Token)
}

func loadShares(root string) (shareFile, error) {
	var sf shareFile
	data, err := os.ReadFile(filepath.Join(root, ".nodishare.json"))
	if err != nil {
		if os.IsNotExist(err) {
			return sf, nil
		}
		return sf, err
	}
	json.Unmarshal(data, &sf)
	for i := range sf.Shares {
		if sf.Shares[i].TokenHash == "" && sf.Shares[i].Token != "" {
			sf.Shares[i].TokenHash = shareTokenHash(sf.Shares[i].Token)
		}
	}
	return sf, nil
}

func saveShares(root string, sf shareFile) error {
	for i := range sf.Shares {
		sf.Shares[i] = normalizeShareForStorage(sf.Shares[i])
	}
	data, err := json.MarshalIndent(sf, "", "  ")
	if err != nil {
		return err
	}
	tmp := filepath.Join(root, ".nodishare.json.tmp")
	if err := os.WriteFile(tmp, data, 0600); err != nil {
		return err
	}
	return os.Rename(tmp, filepath.Join(root, ".nodishare.json"))
}

func shareCookieName(token string) string {
	// Use a hash prefix instead of the raw token so the cookie name does not
	// leak the unhashed share token in request headers and server logs.
	sum := sha256.Sum256([]byte(token))
	return "ql_share_" + hex.EncodeToString(sum[:8])
}

func signShareUnlock(secret, token string, exp int64) string {
	mac := hmac.New(sha256.New, []byte(secret))
	fmt.Fprintf(mac, "%s:%d", token, exp)
	return hex.EncodeToString(mac.Sum(nil))
}

func shareUnlockCookieValue(secret, token string, ttl time.Duration) string {
	exp := time.Now().Add(ttl).Unix()
	return fmt.Sprintf("%d.%s", exp, signShareUnlock(secret, token, exp))
}

func validShareUnlockCookie(r *http.Request, secret, token string) bool {
	cookie, err := r.Cookie(shareCookieName(token))
	if err != nil {
		return false
	}
	parts := strings.Split(cookie.Value, ".")
	if len(parts) != 2 {
		return false
	}
	expUnix, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil || time.Now().Unix() > expUnix {
		return false
	}
	expected := signShareUnlock(secret, token, expUnix)
	return hmac.Equal([]byte(parts[1]), []byte(expected))
}

func renderSharePassword(w http.ResponseWriter, token string, status int, message string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(status)
	_ = sharePasswordTemplate.Execute(w, map[string]string{
		"Token": token,
		"Error": message,
	})
}

func shareURL(token, subPath string) string {
	if subPath == "" {
		return "/s/" + url.PathEscape(token)
	}
	parts := strings.Split(strings.Trim(subPath, "/"), "/")
	escaped := make([]string, 0, len(parts)+2)
	escaped = append(escaped, "s", url.PathEscape(token))
	for _, part := range parts {
		if part != "" {
			escaped = append(escaped, url.PathEscape(part))
		}
	}
	return "/" + strings.Join(escaped, "/")
}

func renderShareDropbox(w http.ResponseWriter, token string, message string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_ = shareDropboxTemplate.Execute(w, map[string]string{
		"Token":   token,
		"Message": message,
	})
}

func handleShareUpload(cfg *config.Config, share *shareEntry, token string, w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}
	if share.Mode != "upload" || !share.IsDir {
		http.Error(w, "Upload is not enabled for this share", http.StatusForbidden)
		return
	}

	maxUpload := cfg.MaxUpload
	if maxUpload <= 0 {
		maxUpload = 2147483648
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxUpload)
	mr, err := r.MultipartReader()
	if err != nil {
		http.Error(w, "Expected multipart upload", http.StatusBadRequest)
		return
	}
	shareRoot, err := SafePath(cfg.Root, share.Path)
	if err != nil {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	if freeBytes, err := freeBytesAtPath(shareRoot); err == nil && freeBytes <= 0 {
		http.Error(w, diskFullMessage, http.StatusInsufficientStorage)
		return
	}
	existingFiles := 0
	if share.MaxFileCount > 0 {
		if entries, err := os.ReadDir(shareRoot); err == nil {
			for _, entry := range entries {
				if !entry.IsDir() {
					existingFiles++
				}
			}
		}
	}
	uploaded := 0
	for {
		part, err := mr.NextPart()
		if err == io.EOF {
			break
		}
		if err != nil {
			http.Error(w, "Failed to read upload", http.StatusBadRequest)
			return
		}
		if part.FormName() != "files" {
			part.Close()
			continue
		}
		filename := filepath.Base(part.FileName())
		if !validName(filename) {
			part.Close()
			http.Error(w, "Invalid filename", http.StatusBadRequest)
			return
		}
		dstPath := filepath.Join(shareRoot, filename)
		if _, err := os.Stat(dstPath); err == nil {
			part.Close()
			http.Error(w, "File already exists", http.StatusConflict)
			return
		}
		if share.MaxFileCount > 0 && existingFiles+uploaded >= share.MaxFileCount {
			part.Close()
			http.Error(w, fmt.Sprintf("This dropbox already reached its %d-file limit.", share.MaxFileCount), http.StatusConflict)
			return
		}
		tmp, err := os.CreateTemp(shareRoot, ".nodi-share-upload-*")
		if err != nil {
			part.Close()
			http.Error(w, "Upload staging failed", http.StatusInternalServerError)
			return
		}
		tmpPath := tmp.Name()
		var written int64
		if share.MaxFileSize > 0 {
			written, err = io.Copy(tmp, io.LimitReader(part, share.MaxFileSize+1))
			if err == nil && written > share.MaxFileSize {
				part.Close()
				tmp.Close()
				os.Remove(tmpPath)
				http.Error(w, fmt.Sprintf("File is larger than the %s dropbox limit.", humanSize(share.MaxFileSize)), http.StatusRequestEntityTooLarge)
				return
			}
		} else {
			written, err = io.Copy(tmp, part)
		}
		if err != nil {
			part.Close()
			tmp.Close()
			os.Remove(tmpPath)
			status := http.StatusInternalServerError
			if isDiskFullErr(err) {
				status = http.StatusInsufficientStorage
			}
			http.Error(w, uploadHTTPErrorMessage(err, "Upload failed"), status)
			return
		}
		part.Close()
		if err := tmp.Close(); err != nil {
			os.Remove(tmpPath)
			status := http.StatusInternalServerError
			if isDiskFullErr(err) {
				status = http.StatusInsufficientStorage
			}
			http.Error(w, uploadHTTPErrorMessage(err, "Upload failed"), status)
			return
		}
		if err := os.Rename(tmpPath, dstPath); err != nil {
			os.Remove(tmpPath)
			status := http.StatusInternalServerError
			if isDiskFullErr(err) {
				status = http.StatusInsufficientStorage
			}
			http.Error(w, uploadHTTPErrorMessage(err, "Upload finalize failed"), status)
			return
		}
		uploaded++
		storage.Append(cfg.Root, storage.ActivityEvent{User: "public", Action: "share.upload", Path: share.Path + "/" + filename, Extra: fmt.Sprintf("%d bytes", written)})
	}
	if uploaded == 0 {
		http.Error(w, "No files uploaded", http.StatusBadRequest)
		return
	}
	renderShareDropbox(w, token, fmt.Sprintf("Uploaded %d file%s.", uploaded, map[bool]string{true: "", false: "s"}[uploaded == 1]))
}

func sessionUserFromCtx(ctx interface{}) string {
	type context interface {
		Value(key interface{}) interface{}
	}
	if c, ok := ctx.(context); ok {
		if s, ok := c.Value(middleware.SessionKey).(*auth.Session); ok && s != nil {
			return s.User
		}
	}
	return "admin"
}

func CreateShare(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			Path         string `json:"path"`
			ExpiresAt    string `json:"expires_at"`
			Password     string `json:"password"`
			Mode         string `json:"mode"`
			MaxFileSize  int64  `json:"max_file_size"`
			MaxFileCount int    `json:"max_file_count"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		if req.Path == "" {
			http.Error(w, "path is required", http.StatusBadRequest)
			return
		}
		if req.Mode == "" {
			req.Mode = "read"
		}
		if req.Mode != "read" && req.Mode != "upload" {
			http.Error(w, "mode must be read or upload", http.StatusBadRequest)
			return
		}
		if req.ExpiresAt != "" {
			if _, err := parseShareExpiry(req.ExpiresAt); err != nil {
				http.Error(w, "invalid expiry", http.StatusBadRequest)
				return
			}
		}
		if req.MaxFileSize < 0 || req.MaxFileCount < 0 {
			http.Error(w, "share limits must be non-negative", http.StatusBadRequest)
			return
		}
		if req.Mode != "upload" && (req.MaxFileSize > 0 || req.MaxFileCount > 0) {
			http.Error(w, "file limits are only valid for upload dropboxes", http.StatusBadRequest)
			return
		}

		fullPath, err := SafePath(cfg.Root, req.Path)
		if err != nil {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}
		info, err := os.Stat(fullPath)
		if err != nil {
			http.Error(w, "Not found", http.StatusNotFound)
			return
		}
		if req.Mode == "upload" && !info.IsDir() {
			http.Error(w, "upload dropboxes must target a folder", http.StatusBadRequest)
			return
		}

		token := newShareToken()
		var pwHash string
		if req.Password != "" {
			h, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
			if err != nil {
				http.Error(w, "failed to hash password", http.StatusInternalServerError)
				return
			}
			pwHash = string(h)
		}

		entry := shareEntry{
			TokenHash:    shareTokenHash(token),
			Path:         req.Path,
			IsDir:        info.IsDir(),
			CreatedAt:    time.Now().UTC().Format(time.RFC3339),
			CreatedBy:    sessionUserFromCtx(r.Context()),
			ExpiresAt:    req.ExpiresAt,
			PasswordHash: pwHash,
			Mode:         req.Mode,
			MaxFileSize:  req.MaxFileSize,
			MaxFileCount: req.MaxFileCount,
		}

		sf, err := loadShares(cfg.Root)
		if err != nil {
			http.Error(w, "failed to load shares", http.StatusInternalServerError)
			return
		}
		sf.Shares = append(sf.Shares, entry)
		if err := saveShares(cfg.Root, sf); err != nil {
			http.Error(w, "failed to save share", http.StatusInternalServerError)
			return
		}

		storage.Append(cfg.Root, storage.ActivityEvent{
			User:   sessionUserFromCtx(r.Context()),
			Action: "share.create",
			Path:   req.Path,
		})

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"token": token,
			"url":   fmt.Sprintf("/s/%s", token),
		})
	}
}

func ListShares(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		sf, err := loadShares(cfg.Root)
		if err != nil {
			http.Error(w, "failed to load shares", http.StatusInternalServerError)
			return
		}

		type shareOut struct {
			Token        string `json:"token"`
			Path         string `json:"path"`
			IsDir        bool   `json:"is_dir"`
			CreatedAt    string `json:"created_at"`
			CreatedBy    string `json:"created_by"`
			ExpiresAt    string `json:"expires_at"`
			HasPassword  bool   `json:"has_password"`
			Mode         string `json:"mode"`
			URL          string `json:"url"`
			Status       string `json:"status"`
			MaxFileSize  int64  `json:"max_file_size"`
			MaxFileCount int    `json:"max_file_count"`
		}

		out := make([]shareOut, 0, len(sf.Shares))
		for _, s := range sf.Shares {
			status := "active"
			if s.ExpiresAt != "" {
				if exp, err := parseShareExpiry(s.ExpiresAt); err == nil && time.Now().UTC().After(exp) {
					status = "expired"
				}
			}
			out = append(out, shareOut{
				Token:        shareReference(s),
				Path:         s.Path,
				IsDir:        s.IsDir,
				CreatedAt:    s.CreatedAt,
				CreatedBy:    s.CreatedBy,
				ExpiresAt:    s.ExpiresAt,
				HasPassword:  s.PasswordHash != "",
				Mode:         s.Mode,
				URL:          sharePublicURL(s),
				Status:       status,
				MaxFileSize:  s.MaxFileSize,
				MaxFileCount: s.MaxFileCount,
			})
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(out)
	}
}

func RevokeShare(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		token := r.URL.Query().Get("token")
		if token == "" {
			http.Error(w, "token is required", http.StatusBadRequest)
			return
		}

		sf, err := loadShares(cfg.Root)
		if err != nil {
			http.Error(w, "failed to load shares", http.StatusInternalServerError)
			return
		}

		var found bool
		var revokedPath string
		filtered := sf.Shares[:0]
		for _, s := range sf.Shares {
			if shareMatchesToken(s, token) {
				found = true
				revokedPath = s.Path
			} else {
				filtered = append(filtered, s)
			}
		}
		sf.Shares = filtered

		if !found {
			http.Error(w, "share not found", http.StatusNotFound)
			return
		}

		if err := saveShares(cfg.Root, sf); err != nil {
			http.Error(w, "failed to save shares", http.StatusInternalServerError)
			return
		}

		storage.Append(cfg.Root, storage.ActivityEvent{
			User:   sessionUserFromCtx(r.Context()),
			Action: "share.revoke",
			Path:   revokedPath,
		})

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]bool{"success": true})
	}
}

func SharesRouter(cfg *config.Config) http.HandlerFunc {
	create := CreateShare(cfg)
	list := ListShares(cfg)
	revoke := RevokeShare(cfg)

	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			create.ServeHTTP(w, r)
		case http.MethodGet:
			list.ServeHTTP(w, r)
		case http.MethodDelete:
			revoke.ServeHTTP(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	}
}

func ServeShare(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Path is "/s/{token}" or "/s/{token}/sub/path" after StripPrefix
		parts := strings.SplitN(strings.TrimPrefix(r.URL.Path, "/"), "/", 2)
		token := parts[0]
		var subPath string
		if len(parts) > 1 {
			subPath = parts[1]
		}

		if token == "" {
			http.Error(w, "Not found", http.StatusNotFound)
			return
		}

		sf, err := loadShares(cfg.Root)
		if err != nil {
			http.Error(w, "Internal error", http.StatusInternalServerError)
			return
		}

		var share *shareEntry
		for i := range sf.Shares {
			if shareMatchesToken(sf.Shares[i], token) {
				share = &sf.Shares[i]
				break
			}
		}
		if share == nil {
			http.Error(w, "Not found", http.StatusNotFound)
			return
		}

		// Check expiry
		if share.ExpiresAt != "" {
			exp, err := parseShareExpiry(share.ExpiresAt)
			if err == nil && time.Now().UTC().After(exp) {
				http.Error(w, "This share link has expired", http.StatusGone)
				return
			}
		}

		if subPath == "unlock" {
			if r.Method != http.MethodPost {
				http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
				return
			}
			if share.PasswordHash == "" {
				http.Redirect(w, r, shareURL(token, ""), http.StatusSeeOther)
				return
			}
			password := ""
			if strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
				var req struct {
					Password string `json:"password"`
				}
				if err := json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&req); err == nil {
					password = req.Password
				}
			} else {
				if err := r.ParseForm(); err == nil {
					password = r.FormValue("password")
				}
			}
			if password == "" || bcrypt.CompareHashAndPassword([]byte(share.PasswordHash), []byte(password)) != nil {
				renderSharePassword(w, token, http.StatusUnauthorized, "Incorrect password")
				return
			}
			http.SetCookie(w, &http.Cookie{
				Name:     shareCookieName(token),
				Value:    shareUnlockCookieValue(cfg.CookieSecret, token, 12*time.Hour),
				Path:     shareURL(token, ""),
				HttpOnly: true,
				Secure:   r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https",
				SameSite: http.SameSiteLaxMode,
				MaxAge:   int((12 * time.Hour).Seconds()),
			})
			storage.Append(cfg.Root, storage.ActivityEvent{
				User:   "public",
				Action: "share.unlock",
				Path:   share.Path,
			})
			http.Redirect(w, r, shareURL(token, ""), http.StatusSeeOther)
			return
		}
		// Check password
		if share.PasswordHash != "" {
			if !validShareUnlockCookie(r, cfg.CookieSecret, token) {
				renderSharePassword(w, token, http.StatusUnauthorized, "")
				return
			}
		}
		if subPath == "upload" {
			handleShareUpload(cfg, share, token, w, r)
			return
		}

		// Resolve the real path
		shareRoot, err := SafePath(cfg.Root, share.Path)
		if err != nil {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}

		if share.IsDir {
			if share.Mode == "upload" {
				storage.Append(cfg.Root, storage.ActivityEvent{
					User:   "public",
					Action: "share.open",
					Path:   share.Path,
				})
				renderShareDropbox(w, token, "")
				return
			}
			// Serving a directory share
			targetPath := shareRoot
			if subPath != "" {
				candidate := filepath.Join(shareRoot, filepath.FromSlash(subPath))
				cleanCandidate := filepath.Clean(candidate)
				if !strings.HasPrefix(cleanCandidate, filepath.Clean(shareRoot)+string(filepath.Separator)) && cleanCandidate != filepath.Clean(shareRoot) {
					http.Error(w, "Forbidden", http.StatusForbidden)
					return
				}
				targetPath = cleanCandidate
			}

			info, err := os.Stat(targetPath)
			if err != nil {
				http.Error(w, "Not found", http.StatusNotFound)
				return
			}

			if !info.IsDir() {
				// Serve the file with download
				storage.Append(cfg.Root, storage.ActivityEvent{
					User:   "public",
					Action: "share.download",
					Path:   filepath.ToSlash(strings.TrimSuffix(share.Path, "/") + "/" + strings.TrimPrefix(subPath, "/")),
				})
				w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filepath.Base(targetPath)))
				http.ServeFile(w, r, targetPath)
				return
			}

			// Render HTML listing
			entries, err := os.ReadDir(targetPath)
			if err != nil {
				http.Error(w, "Internal error", http.StatusInternalServerError)
				return
			}

			relToShare := ""
			if subPath != "" {
				relToShare = subPath
			}

			page := shareListPage{
				Token: token,
				Title: "Shared Folder",
			}
			if subPath != "" {
				parent := filepath.ToSlash(filepath.Dir(subPath))
				if parent == "." {
					parent = ""
				}
				page.Parent = shareURL(token, parent)
			}
			for _, e := range entries {
				name := e.Name()
				hrefPath := ""
				if relToShare != "" {
					hrefPath = relToShare + "/"
				}
				hrefPath += name
				page.Entries = append(page.Entries, shareListItem{
					Name:  name,
					URL:   shareURL(token, hrefPath),
					IsDir: e.IsDir(),
				})
			}
			storage.Append(cfg.Root, storage.ActivityEvent{
				User:   "public",
				Action: "share.list",
				Path:   share.Path,
				Extra:  subPath,
			})
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			if err := shareDirectoryTemplate.Execute(w, page); err != nil {
				http.Error(w, "Template error", http.StatusInternalServerError)
			}
		} else {
			// File share
			storage.Append(cfg.Root, storage.ActivityEvent{
				User:   "public",
				Action: "share.download",
				Path:   share.Path,
			})
			w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filepath.Base(shareRoot)))
			http.ServeFile(w, r, shareRoot)
		}
	}
}
