package handlers

import (
	"context"
	"net/http"
	"os"
	"path"
	"strings"

	"github.com/Twarga/Nodi/internal/config"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/net/webdav"
)

var davBlockedRootNames = map[string]bool{
	".cache":          true,
	".trash":          true,
	".nodifav.json":   true,
	".nodilog.jsonl":  true,
	".nodishare.json": true,
}

// WebDAV exposes the file root to native device file managers.
// It uses Basic Auth because WebDAV clients usually cannot use browser cookies.
func WebDAV(cfg *config.Config) http.Handler {
	dav := &webdav.Handler{
		Prefix:     "/dav",
		FileSystem: safeDAVFileSystem{base: webdav.Dir(cfg.Root)},
		LockSystem: webdav.NewMemLS(),
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !validDAVBasicAuth(cfg, r) {
			w.Header().Set("WWW-Authenticate", `Basic realm="Nodi WebDAV"`)
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		dav.ServeHTTP(w, r)
	})
}

func validDAVBasicAuth(cfg *config.Config, r *http.Request) bool {
	username, password, ok := r.BasicAuth()
	if !ok {
		return false
	}
	if username != cfg.User {
		return false
	}
	return bcrypt.CompareHashAndPassword([]byte(cfg.PassHash), []byte(password)) == nil
}

type safeDAVFileSystem struct {
	base webdav.FileSystem
}

func (fs safeDAVFileSystem) Mkdir(ctx context.Context, name string, perm os.FileMode) error {
	if err := validateDAVName(name); err != nil {
		return err
	}
	return fs.base.Mkdir(ctx, name, perm)
}

func (fs safeDAVFileSystem) OpenFile(ctx context.Context, name string, flag int, perm os.FileMode) (webdav.File, error) {
	if err := validateDAVName(name); err != nil {
		return nil, err
	}
	return fs.base.OpenFile(ctx, name, flag, perm)
}

func (fs safeDAVFileSystem) RemoveAll(ctx context.Context, name string) error {
	if err := validateDAVName(name); err != nil {
		return err
	}
	return fs.base.RemoveAll(ctx, name)
}

func (fs safeDAVFileSystem) Rename(ctx context.Context, oldName, newName string) error {
	if err := validateDAVName(oldName); err != nil {
		return err
	}
	if err := validateDAVName(newName); err != nil {
		return err
	}
	return fs.base.Rename(ctx, oldName, newName)
}

func (fs safeDAVFileSystem) Stat(ctx context.Context, name string) (os.FileInfo, error) {
	if err := validateDAVName(name); err != nil {
		return nil, err
	}
	return fs.base.Stat(ctx, name)
}

func validateDAVName(name string) error {
	clean := path.Clean("/" + name)
	if clean == "/" {
		return nil
	}
	for _, part := range strings.Split(strings.TrimPrefix(clean, "/"), "/") {
		if part == "" || part == "." || part == ".." {
			return os.ErrPermission
		}
		if strings.HasPrefix(part, ".nodi-") {
			return os.ErrPermission
		}
	}
	first := strings.Split(strings.TrimPrefix(clean, "/"), "/")[0]
	if davBlockedRootNames[first] {
		return os.ErrPermission
	}
	return nil
}
