package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	stdmime "mime"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	"nodi/internal/config"
	"nodi/internal/storage"
)

// FileInfo represents metadata for a file or directory.
type FileInfo struct {
	Name    string    `json:"name"`
	Size    int64     `json:"size"`
	IsDir   bool      `json:"is_dir"`
	ModTime time.Time `json:"mod_time"`
	Ext     string    `json:"ext"`
	MIME    string    `json:"mime"`
}

type BreadcrumbSegment struct {
	Name string
	Path string
}

func BuildBreadcrumbs(subPath string) []BreadcrumbSegment {
	cleanPath := filepath.Clean("/" + strings.TrimPrefix(subPath, "/"))
	if cleanPath == "/" || cleanPath == "." {
		return []BreadcrumbSegment{}
	}

	parts := strings.Split(strings.Trim(cleanPath, "/"), "/")
	segments := make([]BreadcrumbSegment, 0, len(parts))
	current := ""
	for _, part := range parts {
		if part == "" {
			continue
		}
		current += "/" + part
		segments = append(segments, BreadcrumbSegment{Name: part, Path: current})
	}
	return segments
}

func ListFiles(fullPath string) ([]FileInfo, error) {
	entries, err := os.ReadDir(fullPath)
	if err != nil {
		return nil, err
	}

	files := make([]FileInfo, 0, len(entries))
	for _, entry := range entries {
		info, err := entry.Info()
		if err != nil {
			continue
		}

		files = append(files, FileInfo{
			Name:    entry.Name(),
			Size:    info.Size(),
			IsDir:   entry.IsDir(),
			ModTime: info.ModTime(),
			Ext:     storage.GetExt(entry.Name()),
			MIME:    storage.GetMIME(entry.Name()),
		})
	}

	sort.Slice(files, func(i, j int) bool {
		if files[i].IsDir != files[j].IsDir {
			return files[i].IsDir
		}
		return strings.ToLower(files[i].Name) < strings.ToLower(files[j].Name)
	})

	return files, nil
}

// SafePath resolves a subpath against a root directory and ensures no traversal.
func SafePath(root, subPath string) (string, error) {
	absRoot, err := filepath.Abs(root)
	if err != nil {
		return "", fmt.Errorf("invalid root path: %v", err)
	}
	realRoot, err := filepath.EvalSymlinks(absRoot)
	if err != nil {
		return "", fmt.Errorf("invalid root path: %v", err)
	}

	candidate := filepath.Join(realRoot, filepath.FromSlash(subPath))

	realCandidate, err := filepath.EvalSymlinks(candidate)
	if err == nil {
		if !isWithinRoot(realRoot, realCandidate) {
			return "", fmt.Errorf("path escapes root: %s", subPath)
		}
		return realCandidate, nil
	}
	if !os.IsNotExist(err) {
		return "", fmt.Errorf("invalid path: %v", err)
	}

	parent := filepath.Dir(candidate)
	realParent, err := filepath.EvalSymlinks(parent)
	if err != nil {
		return "", fmt.Errorf("invalid parent path: %v", err)
	}

	if !isWithinRoot(realRoot, realParent) {
		return "", fmt.Errorf("path escapes root: %s", subPath)
	}

	return filepath.Join(realParent, filepath.Base(candidate)), nil
}

func isWithinRoot(root, path string) bool {
	rel, err := filepath.Rel(root, path)
	if err != nil {
		return false
	}
	return rel == "." || (rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator)))
}

func validName(name string) bool {
	name = strings.TrimSpace(name)
	if name == "" || name == "." || name == ".." {
		return false
	}
	if !utf8.ValidString(name) || utf8.RuneCountInString(name) > 255 {
		return false
	}
	for _, r := range name {
		if r == '/' || r == '\\' || r == 0 || r < 32 || strings.ContainsRune(`'"<>&`, r) {
			return false
		}
	}
	return true
}

// Browse returns a handler that lists directory contents as JSON.
func Browse(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		subPath := r.URL.Query().Get("path")
		fullPath, err := SafePath(cfg.Root, subPath)
		if err != nil {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}

		files, err := ListFiles(fullPath)
		if err != nil {
			if os.IsNotExist(err) {
				http.Error(w, "Not Found", http.StatusNotFound)
				return
			}
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(files)
	}
}

// CreateFolder returns a handler that creates a new directory.
func CreateFolder(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			Path string `json:"path"`
			Name string `json:"name"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Bad Request", http.StatusBadRequest)
			return
		}

		req.Name = strings.TrimSpace(req.Name)
		if !validName(req.Name) {
			http.Error(w, "Invalid folder name", http.StatusBadRequest)
			return
		}

		// Resolve base path
		basePath, err := SafePath(cfg.Root, req.Path)
		if err != nil {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}

		targetPath := filepath.Join(basePath, req.Name)

		// Final check to ensure the target is still within root (extra safety)
		if _, err := SafePath(cfg.Root, filepath.Join(req.Path, req.Name)); err != nil {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}

		if err := os.Mkdir(targetPath, 0755); err != nil {
			if os.IsExist(err) {
				http.Error(w, "Folder already exists", http.StatusConflict)
				return
			}
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]string{"message": "Folder created"})
	}
}

// Delete returns a handler that removes a file or directory.
func Delete(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			Path string `json:"path"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Bad Request", http.StatusBadRequest)
			return
		}

		if req.Path == "" || req.Path == "/" {
			http.Error(w, "Cannot delete root", http.StatusForbidden)
			return
		}

		fullPath, err := SafePath(cfg.Root, req.Path)
		if err != nil {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}

		if err := os.RemoveAll(fullPath); err != nil {
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"message": "Item deleted"})
	}
}

// Rename returns a handler that renames a file or directory.
func Rename(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			OldPath string `json:"oldPath"`
			NewName string `json:"newName"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Bad Request", http.StatusBadRequest)
			return
		}

		req.NewName = strings.TrimSpace(req.NewName)
		if !validName(req.NewName) {
			http.Error(w, "Invalid new name", http.StatusBadRequest)
			return
		}

		oldFullPath, err := SafePath(cfg.Root, req.OldPath)
		if err != nil {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}

		// Ensure we don't rename root
		if req.OldPath == "/" {
			http.Error(w, "Cannot rename root", http.StatusForbidden)
			return
		}

		// Construct new path in the same directory
		parentDir := filepath.Dir(oldFullPath)
		newFullPath := filepath.Join(parentDir, req.NewName)

		// Extra safety check: resolve the subpath version too
		subDir := filepath.Dir(req.OldPath)
		if _, err := SafePath(cfg.Root, filepath.Join(subDir, req.NewName)); err != nil {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}

		// Check if target already exists
		if _, err := os.Stat(newFullPath); err == nil {
			http.Error(w, "Target already exists", http.StatusConflict)
			return
		}

		if err := os.Rename(oldFullPath, newFullPath); err != nil {
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"message": "Item renamed"})
	}
}

// Download returns a handler that streams a file from the configured root.
func Download(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}

		reqPath := r.URL.Query().Get("path")
		if reqPath == "" || reqPath == "/" {
			http.Error(w, "File path required", http.StatusBadRequest)
			return
		}

		fullPath, err := SafePath(cfg.Root, reqPath)
		if err != nil {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}

		info, err := os.Stat(fullPath)
		if err != nil {
			if os.IsNotExist(err) {
				http.Error(w, "Not Found", http.StatusNotFound)
				return
			}
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}
		if info.IsDir() {
			http.Error(w, "Cannot download directory", http.StatusBadRequest)
			return
		}

		w.Header().Set("Content-Disposition", stdmime.FormatMediaType("attachment", map[string]string{
			"filename": filepath.Base(fullPath),
		}))
		http.ServeFile(w, r, fullPath)
	}
}

// Upload returns a handler that receives multipart files and saves them.
func Upload(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}

		maxUpload := cfg.MaxUpload
		if maxUpload <= 0 {
			maxUpload = 2147483648
		}
		r.Body = http.MaxBytesReader(w, r.Body, maxUpload)

		if err := r.ParseMultipartForm(32 << 20); err != nil { // 32MB in-memory buffer
			http.Error(w, "Failed to parse form: "+err.Error(), http.StatusBadRequest)
			return
		}

		path := r.FormValue("path")
		if path == "" {
			path = "/"
		}

		basePath, err := SafePath(cfg.Root, path)
		if err != nil {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}

		files := r.MultipartForm.File["files"]
		if len(files) == 0 {
			http.Error(w, "No files uploaded", http.StatusBadRequest)
			return
		}

		type Result struct {
			Name  string `json:"name"`
			Error string `json:"error,omitempty"`
		}
		var results []Result

		for _, fileHeader := range files {
			res := Result{Name: fileHeader.Filename}

			// Open the uploaded file
			src, err := fileHeader.Open()
			if err != nil {
				res.Error = "Could not open source"
				results = append(results, res)
				continue
			}
			defer src.Close()

			// Securely resolve destination
			if !validName(fileHeader.Filename) {
				res.Error = "Invalid filename"
				results = append(results, res)
				continue
			}

			dstPath := filepath.Join(basePath, fileHeader.Filename)

			// Stage in the destination directory so final rename stays atomic across Docker volumes.
			tempFile, err := os.CreateTemp(basePath, ".nodi-upload-*")
			if err != nil {
				res.Error = "Staging failed"
				results = append(results, res)
				continue
			}
			tempPath := tempFile.Name()

			// Stream to temp file
			if _, err := io.Copy(tempFile, src); err != nil {
				tempFile.Close()
				os.Remove(tempPath)
				res.Error = "Failed to write data"
				results = append(results, res)
				continue
			}
			tempFile.Close()

			// Atomic rename to final destination
			if err := os.Rename(tempPath, dstPath); err != nil {
				os.Remove(tempPath)
				res.Error = "Finalization failed"
				results = append(results, res)
				continue
			}

			results = append(results, res)
		}

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(results)
	}
}
