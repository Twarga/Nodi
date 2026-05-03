package handlers

import (
	"archive/tar"
	"archive/zip"
	"bytes"
	"compress/gzip"
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

	"github.com/Twarga/Nodi/internal/config"
	"github.com/Twarga/Nodi/internal/storage"
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
		if r == '/' || r == '\\' || r == 0 || r < 32 {
			return false
		}
	}
	return true
}

// Edit handles reading and writing text files for inline editing (≤1MB, text only).
func Edit(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		fullPath, err := SafePath(cfg.Root, r.URL.Query().Get("path"))
		if err != nil {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}

		switch r.Method {
		case http.MethodGet:
			info, err := os.Stat(fullPath)
			if err != nil || info.IsDir() || info.Size() > 1024*1024 {
				http.Error(w, "Not found or too large", http.StatusNotFound)
				return
			}
			data, err := os.ReadFile(fullPath)
			if err != nil || bytes.Contains(data, []byte{0}) {
				http.Error(w, "Cannot read binary file", http.StatusBadRequest)
				return
			}
			w.Header().Set("Content-Type", "text/plain; charset=utf-8")
			w.Write(data)

		case http.MethodPut:
			data, err := io.ReadAll(io.LimitReader(r.Body, 1024*1024))
			if err != nil {
				http.Error(w, "Read error", http.StatusBadRequest)
				return
			}
			if err := os.WriteFile(fullPath, data, 0644); err != nil {
				http.Error(w, "Write failed", http.StatusInternalServerError)
				return
			}
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]bool{"success": true})

		default:
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		}
	}
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

		// Search/filter
		if search := r.URL.Query().Get("search"); search != "" {
			s := strings.ToLower(strings.TrimSpace(search))
			filtered := files[:0]
			for _, f := range files {
				if strings.Contains(strings.ToLower(f.Name), s) {
					filtered = append(filtered, f)
				}
			}
			files = filtered
		}

		// Sorting
		sortBy := r.URL.Query().Get("sort")
		order := strings.ToLower(r.URL.Query().Get("order"))
		if order != "asc" && order != "desc" {
			order = "asc"
		}
		switch sortBy {
		case "size":
			sort.Slice(files, func(i, j int) bool {
				if files[i].IsDir != files[j].IsDir {
					return files[i].IsDir
				}
				if order == "asc" {
					return files[i].Size < files[j].Size
				}
				return files[i].Size > files[j].Size
			})
		case "modified":
			sort.Slice(files, func(i, j int) bool {
				if files[i].IsDir != files[j].IsDir {
					return files[i].IsDir
				}
				if order == "asc" {
					return files[i].ModTime.Before(files[j].ModTime)
				}
				return files[i].ModTime.After(files[j].ModTime)
			})
		default: // "name" or empty
			sort.Slice(files, func(i, j int) bool {
				if files[i].IsDir != files[j].IsDir {
					return files[i].IsDir
				}
				if order == "asc" {
					return strings.ToLower(files[i].Name) < strings.ToLower(files[j].Name)
				}
				return strings.ToLower(files[i].Name) > strings.ToLower(files[j].Name)
			})
		}

		// Pagination
		limit := 200
		page := 1
		if l := r.URL.Query().Get("limit"); l != "" {
			if parsed, err := fmt.Sscanf(l, "%d", &limit); err == nil && parsed == 1 && limit > 0 && limit <= 1000 {
			} else {
				limit = 200
			}
		}
		if p := r.URL.Query().Get("page"); p != "" {
			if parsed, err := fmt.Sscanf(p, "%d", &page); err == nil && parsed == 1 && page > 0 {
			} else {
				page = 1
			}
		}

		total := len(files)
		start := (page - 1) * limit
		if start > total {
			start = total
		}
		end := start + limit
		if end > total {
			end = total
		}
		hasMore := end < total

		result := struct {
			Files   []FileInfo `json:"files"`
			Total   int        `json:"total"`
			HasMore bool       `json:"hasMore"`
		}{
			Files:   files[start:end],
			Total:   total,
			HasMore: hasMore,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
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

			// Securely resolve destination
			if !validName(fileHeader.Filename) {
				res.Error = "Invalid filename"
				results = append(results, res)
				continue
			}

			dstPath := filepath.Join(basePath, fileHeader.Filename)

			// Check for existing file
			if _, err := os.Stat(dstPath); err == nil {
				res.Error = "file exists"
				results = append(results, res)
				continue
			}

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
				src.Close()
				tempFile.Close()
				os.Remove(tempPath)
				res.Error = "Failed to write data"
				results = append(results, res)
				continue
			}
			src.Close()
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

// Move renames a file or directory safely within QL_ROOT.
func Move(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			Src string `json:"src"`
			Dst string `json:"dst"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Bad Request", http.StatusBadRequest)
			return
		}

		srcPath, err := SafePath(cfg.Root, req.Src)
		if err != nil {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}
		dstPath, err := SafePath(cfg.Root, req.Dst)
		if err != nil {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}

		if os.Rename(srcPath, dstPath) != nil {
			http.Error(w, "Move failed", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]bool{"success": true})
	}
}

// Copy duplicates a file or directory safely within QL_ROOT.
func Copy(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			Src string `json:"src"`
			Dst string `json:"dst"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Bad Request", http.StatusBadRequest)
			return
		}

		srcPath, err := SafePath(cfg.Root, req.Src)
		if err != nil {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}
		dstPath, err := SafePath(cfg.Root, req.Dst)
		if err != nil {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}

		if err := copyPath(srcPath, dstPath); err != nil {
			http.Error(w, "Copy failed: "+err.Error(), http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]bool{"success": true})
	}
}

func copyPath(src, dst string) error {
	srcInfo, err := os.Stat(src)
	if err != nil {
		return err
	}
	if !srcInfo.IsDir() {
		return copyFile(src, dst)
	}
	if err := os.MkdirAll(dst, srcInfo.Mode()); err != nil {
		return err
	}
	entries, err := os.ReadDir(src)
	if err != nil {
		return err
	}
	for _, e := range entries {
		if err := copyPath(filepath.Join(src, e.Name()), filepath.Join(dst, e.Name())); err != nil {
			return err
		}
	}
	return nil
}

func copyFile(src, dst string) error {
	s, err := os.Open(src)
	if err != nil {
		return err
	}
	defer s.Close()
	d, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer d.Close()
	_, err = io.Copy(d, s)
	return err
}

// Compress streams selected files/folders as a ZIP download.
func Compress(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			Paths []string `json:"paths"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(req.Paths) == 0 {
			http.Error(w, "Bad Request", http.StatusBadRequest)
			return
		}

		w.Header().Set("Content-Type", "application/zip")
		w.Header().Set("Content-Disposition", `attachment; filename="download.zip"`)

		zw := zip.NewWriter(w)
		defer zw.Close()

		for _, p := range req.Paths {
			fullPath, err := SafePath(cfg.Root, p)
			if err != nil {
				continue
			}
			addToZip(zw, fullPath, "")
		}
	}
}

func addToZip(zw *zip.Writer, fullPath, prefix string) {
	info, err := os.Stat(fullPath)
	if err != nil {
		return
	}
	name := filepath.Join(prefix, filepath.Base(fullPath))
	if info.IsDir() {
		entries, _ := os.ReadDir(fullPath)
		for _, e := range entries {
			addToZip(zw, filepath.Join(fullPath, e.Name()), name)
		}
		return
	}
	header, err := zip.FileInfoHeader(info)
	if err != nil {
		return
	}
	header.Name = name
	header.Method = zip.Deflate
	w, err := zw.CreateHeader(header)
	if err != nil {
		return
	}
	src, err := os.Open(fullPath)
	if err != nil {
		return
	}
	defer src.Close()
	io.Copy(w, src)
}

// CreateFile creates an empty file inside QL_ROOT.
func CreateFile(cfg *config.Config) http.HandlerFunc {
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
		if !validName(req.Name) {
			http.Error(w, "Invalid filename", http.StatusBadRequest)
			return
		}
		fullPath, err := SafePath(cfg.Root, req.Path)
		if err != nil {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}
		f, err := os.Create(filepath.Join(fullPath, req.Name))
		if err != nil {
			http.Error(w, "Create failed", http.StatusInternalServerError)
			return
		}
		f.Close()
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]bool{"success": true})
	}
}

// Extract decompresses a supported archive in place.
func Extract(cfg *config.Config) http.HandlerFunc {
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

		fullPath, err := SafePath(cfg.Root, req.Path)
		if err != nil {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}

		dest := filepath.Dir(fullPath)
		ext := strings.ToLower(filepath.Ext(fullPath))

		switch ext {
		case ".zip":
			err = extractZip(fullPath, dest)
		case ".gz":
			if strings.HasSuffix(strings.ToLower(fullPath), ".tar.gz") {
				err = extractTarGz(fullPath, dest)
			} else {
				http.Error(w, "Unsupported format", http.StatusBadRequest)
				return
			}
		case ".tar":
			err = extractTar(fullPath, dest)
		default:
			http.Error(w, "Unsupported format", http.StatusBadRequest)
			return
		}

		if err != nil {
			http.Error(w, "Extract failed: "+err.Error(), http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]bool{"success": true})
	}
}

func extractZip(src, dest string) error {
	r, err := zip.OpenReader(src)
	if err != nil {
		return err
	}
	defer r.Close()
	for _, f := range r.File {
		if err := extractZipFile(f, dest); err != nil {
			return err
		}
	}
	return nil
}

func extractZipFile(f *zip.File, dest string) error {
	rc, err := f.Open()
	if err != nil {
		return err
	}
	defer rc.Close()

	target := filepath.Join(dest, f.Name)
	if !strings.HasPrefix(filepath.Clean(target), filepath.Clean(dest)+string(filepath.Separator)) {
		return fmt.Errorf("zip traversal: %s", f.Name)
	}

	if f.FileInfo().IsDir() {
		return os.MkdirAll(target, 0755)
	}

	if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
		return err
	}
	out, err := os.Create(target)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, rc)
	return err
}

func extractTar(src, dest string) error {
	f, err := os.Open(src)
	if err != nil {
		return err
	}
	defer f.Close()
	tr := tar.NewReader(f)
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		target := filepath.Join(dest, hdr.Name)
		if !strings.HasPrefix(filepath.Clean(target), filepath.Clean(dest)+string(filepath.Separator)) {
			return fmt.Errorf("tar traversal: %s", hdr.Name)
		}
		switch hdr.Typeflag {
		case tar.TypeDir:
			os.MkdirAll(target, 0755)
		case tar.TypeReg:
			os.MkdirAll(filepath.Dir(target), 0755)
			out, err := os.Create(target)
			if err != nil {
				return err
			}
			io.Copy(out, tr)
			out.Close()
		}
	}
	return nil
}

func extractTarGz(src, dest string) error {
	f, err := os.Open(src)
	if err != nil {
		return err
	}
	defer f.Close()
	gz, err := gzip.NewReader(f)
	if err != nil {
		return err
	}
	defer gz.Close()
	tr := tar.NewReader(gz)
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		target := filepath.Join(dest, hdr.Name)
		if !strings.HasPrefix(filepath.Clean(target), filepath.Clean(dest)+string(filepath.Separator)) {
			return fmt.Errorf("tar.gz traversal: %s", hdr.Name)
		}
		switch hdr.Typeflag {
		case tar.TypeDir:
			os.MkdirAll(target, 0755)
		case tar.TypeReg:
			os.MkdirAll(filepath.Dir(target), 0755)
			out, err := os.Create(target)
			if err != nil {
				return err
			}
			io.Copy(out, tr)
			out.Close()
		}
	}
	return nil
}
