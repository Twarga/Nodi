package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"nodi/internal/config"
	"nodi/internal/storage"
	"regexp"
)

var nameRegex = regexp.MustCompile(`^[a-zA-Z0-9._ -]+$`)

// FileInfo represents metadata for a file or directory.
type FileInfo struct {
	Name    string    `json:"name"`
	Size    int64     `json:"size"`
	IsDir   bool      `json:"is_dir"`
	ModTime time.Time `json:"mod_time"`
	Ext     string    `json:"ext"`
	MIME    string    `json:"mime"`
}

// SafePath resolves a subpath against a root directory and ensures no traversal.
func SafePath(root, subPath string) (string, error) {
	absRoot, err := filepath.Abs(root)
	if err != nil {
		return "", fmt.Errorf("invalid root path: %v", err)
	}

	// Join the absolute root with the subpath
	// filepath.Join will clean the resulting path
	fullPath := filepath.Join(absRoot, filepath.FromSlash(subPath))
	
	// Evaluate the absolute path of the result
	absFull, err := filepath.Abs(fullPath)
	if err != nil {
		return "", fmt.Errorf("invalid path: %v", err)
	}

	// Ensure the resulting absolute path is still within the absolute root
	if !strings.HasPrefix(absFull, absRoot) {
		return "", fmt.Errorf("path traversal attempt detected: %s", subPath)
	}

	return absFull, nil
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

		entries, err := os.ReadDir(fullPath)
		if err != nil {
			if os.IsNotExist(err) {
				http.Error(w, "Not Found", http.StatusNotFound)
				return
			}
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}

		var files []FileInfo
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

		// Sort: Dis first, then by name case-insensitive
		sort.Slice(files, func(i, j int) bool {
			if files[i].IsDir != files[j].IsDir {
				return files[i].IsDir
			}
			return strings.ToLower(files[i].Name) < strings.ToLower(files[j].Name)
		})

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
		if req.Name == "" || !nameRegex.MatchString(req.Name) {
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
