package handlers

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/Twarga/Nodi/internal/auth"
	"github.com/Twarga/Nodi/internal/config"
	"github.com/Twarga/Nodi/internal/middleware"
	"github.com/Twarga/Nodi/internal/storage"
	"golang.org/x/crypto/bcrypt"
)

type shareEntry struct {
	Token        string `json:"token"`
	Path         string `json:"path"`
	IsDir        bool   `json:"is_dir"`
	CreatedAt    string `json:"created_at"`
	ExpiresAt    string `json:"expires_at"`
	PasswordHash string `json:"password_hash"`
	Mode         string `json:"mode"`
}

type shareFile struct {
	Shares []shareEntry `json:"shares"`
}

func newShareToken() string {
	b := make([]byte, 12)
	rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
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
	return sf, nil
}

func saveShares(root string, sf shareFile) error {
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
			Path      string `json:"path"`
			ExpiresAt string `json:"expires_at"`
			Password  string `json:"password"`
			Mode      string `json:"mode"`
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
			Token:        token,
			Path:         req.Path,
			IsDir:        info.IsDir(),
			CreatedAt:    time.Now().UTC().Format(time.RFC3339),
			ExpiresAt:    req.ExpiresAt,
			PasswordHash: pwHash,
			Mode:         req.Mode,
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
			Token       string  `json:"token"`
			Path        string  `json:"path"`
			IsDir       bool    `json:"is_dir"`
			CreatedAt   string  `json:"created_at"`
			ExpiresAt   string  `json:"expires_at"`
			HasPassword bool    `json:"has_password"`
			Mode        string  `json:"mode"`
			URL         string  `json:"url"`
		}

		out := make([]shareOut, 0, len(sf.Shares))
		for _, s := range sf.Shares {
			out = append(out, shareOut{
				Token:       s.Token,
				Path:        s.Path,
				IsDir:       s.IsDir,
				CreatedAt:   s.CreatedAt,
				ExpiresAt:   s.ExpiresAt,
				HasPassword: s.PasswordHash != "",
				Mode:        s.Mode,
				URL:         fmt.Sprintf("/s/%s", s.Token),
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
			if s.Token == token {
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
			if sf.Shares[i].Token == token {
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
			exp, err := time.Parse(time.RFC3339, share.ExpiresAt)
			if err == nil && time.Now().UTC().After(exp) {
				http.Error(w, "This share link has expired", http.StatusGone)
				return
			}
		}

		// Check password
		if share.PasswordHash != "" {
			pw := r.URL.Query().Get("password")
			if pw == "" {
				pw = r.Header.Get("X-Share-Password")
			}
			if pw == "" {
				w.Header().Set("Content-Type", "text/html; charset=utf-8")
				w.WriteHeader(http.StatusUnauthorized)
				fmt.Fprintf(w, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Share - Password Required</title><style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f8f9fa}form{background:#fff;padding:2rem;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.1)}input{padding:.5rem;border:1px solid #ccc;border-radius:4px;width:100%%;box-sizing:border-box}button{margin-top:1rem;padding:.5rem 1.5rem;background:#0891b2;color:#fff;border:none;border-radius:4px;cursor:pointer}</style></head><body><form method="get"><h2>Password Required</h2><input type="password" name="password" placeholder="Enter password" autofocus required><br><button type="submit">Access</button></form></body></html>`)
				return
			}
			if err := bcrypt.CompareHashAndPassword([]byte(share.PasswordHash), []byte(pw)); err != nil {
				http.Error(w, "Incorrect password", http.StatusUnauthorized)
				return
			}
		}

		// Resolve the real path
		shareRoot, err := SafePath(cfg.Root, share.Path)
		if err != nil {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}

		if share.IsDir {
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

			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			fmt.Fprintf(w, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Shared Folder</title><style>body{font-family:sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem}a{display:block;padding:.5rem .75rem;border-bottom:1px solid #eee;color:#0369a1;text-decoration:none}a:hover{background:#f0f9ff}.dir{font-weight:600}</style></head><body><h1>Shared Folder</h1>`)
			if subPath != "" {
				parentToken := token
				fmt.Fprintf(w, `<a href="/s/%s" class="dir">..</a>`, parentToken)
			}
			for _, e := range entries {
				name := e.Name()
				href := "/" + token + "/"
				if relToShare != "" {
					href += relToShare + "/"
				}
				href += name
				if e.IsDir() {
					fmt.Fprintf(w, `<a href="/s%s" class="dir">%s/</a>`, href, name)
				} else {
					fmt.Fprintf(w, `<a href="/s%s">%s</a>`, href, name)
				}
			}
			fmt.Fprintf(w, `</body></html>`)
		} else {
			// File share
			w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filepath.Base(shareRoot)))
			http.ServeFile(w, r, shareRoot)
		}
	}
}
