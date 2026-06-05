package handlers

import (
	"archive/tar"
	"archive/zip"
	"bytes"
	"compress/gzip"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"image"
	_ "image/gif"
	"image/jpeg"
	_ "image/png"
	"io"
	stdmime "mime"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/Twarga/Nodi/internal/config"
	"github.com/Twarga/Nodi/internal/storage"
	"golang.org/x/image/draw"
)

// FileInfo represents metadata for a file or directory.
type FileInfo struct {
	Name       string    `json:"name"`
	Size       int64     `json:"size"`
	IsDir      bool      `json:"is_dir"`
	ModTime    time.Time `json:"mod_time"`
	Ext        string    `json:"ext"`
	MIME       string    `json:"mime"`
	Path       string    `json:"path,omitempty"`
	ParentPath string    `json:"parentPath,omitempty"`
}

type BreadcrumbSegment struct {
	Name string
	Path string
}

type uploadMeta struct {
	UploadID     string    `json:"uploadId"`
	FileName     string    `json:"fileName"`
	Path         string    `json:"path"`
	RelativePath string    `json:"relativePath,omitempty"`
	Conflict     string    `json:"conflict,omitempty"`
	Size         int64     `json:"size"`
	ChunkSize    int64     `json:"chunkSize"`
	TotalChunks  int       `json:"totalChunks"`
	VerifyHash   bool      `json:"verifyHash,omitempty"`
	CreatedAt    time.Time `json:"createdAt"`
}

type trashMeta struct {
	ID           string    `json:"id"`
	OriginalPath string    `json:"original_path"`
	Name         string    `json:"name"`
	IsDir        bool      `json:"is_dir"`
	Size         int64     `json:"size"`
	DeletedAt    time.Time `json:"deleted_at"`
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

func fileInfoFromDirEntry(entry os.DirEntry, relPath string) (FileInfo, error) {
	info, err := entry.Info()
	if err != nil {
		return FileInfo{}, err
	}
	relPath = filepath.ToSlash(strings.TrimPrefix(relPath, "/"))
	parent := filepath.ToSlash(filepath.Dir(relPath))
	if parent == "." {
		parent = ""
	}
	return FileInfo{
		Name:       entry.Name(),
		Size:       info.Size(),
		IsDir:      entry.IsDir(),
		ModTime:    info.ModTime(),
		Ext:        storage.GetExt(entry.Name()),
		MIME:       storage.GetMIME(entry.Name()),
		Path:       relPath,
		ParentPath: parent,
	}, nil
}

func isAppMetadataRootName(name string) bool {
	return backupSkip[name] || strings.HasPrefix(name, ".nodi-")
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

func validUploadID(id string) bool {
	if len(id) < 16 || len(id) > 64 {
		return false
	}
	for _, r := range id {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
			continue
		}
		return false
	}
	return true
}

func cleanRelativeUploadPath(relativePath, fallbackName string) (dirs []string, filename string, err error) {
	relativePath = strings.TrimSpace(filepath.ToSlash(relativePath))
	if relativePath == "" {
		relativePath = fallbackName
	}
	relativePath = strings.TrimPrefix(relativePath, "/")
	cleaned := filepath.Clean(filepath.FromSlash(relativePath))
	if cleaned == "." || cleaned == string(filepath.Separator) {
		return nil, "", fmt.Errorf("invalid relative path")
	}
	parts := strings.Split(filepath.ToSlash(cleaned), "/")
	if len(parts) == 0 {
		return nil, "", fmt.Errorf("invalid relative path")
	}
	for _, part := range parts {
		if !validName(part) {
			return nil, "", fmt.Errorf("invalid relative path")
		}
	}
	filename = parts[len(parts)-1]
	if !validName(filename) {
		return nil, "", fmt.Errorf("invalid filename")
	}
	return parts[:len(parts)-1], filename, nil
}

func uploadDestination(root, basePath, fallbackName, relativePath string) (dir, filename, activityPath string, err error) {
	base, err := SafePath(root, basePath)
	if err != nil {
		return "", "", "", err
	}
	dirs, filename, err := cleanRelativeUploadPath(relativePath, fallbackName)
	if err != nil {
		return "", "", "", err
	}
	dir = base
	if len(dirs) > 0 {
		dir = filepath.Join(append([]string{base}, dirs...)...)
		if !isWithinRoot(base, dir) && dir != base {
			return "", "", "", fmt.Errorf("path escapes upload directory")
		}
	}
	rel := filename
	if len(dirs) > 0 {
		rel = filepath.ToSlash(filepath.Join(append(dirs, filename)...))
	}
	activityPath = strings.TrimSuffix(basePath, "/") + "/" + rel
	if basePath == "" || basePath == "/" {
		activityPath = "/" + rel
	}
	return dir, filename, activityPath, nil
}

func cleanConflictPolicy(policy string) string {
	switch strings.ToLower(strings.TrimSpace(policy)) {
	case "replace":
		return "replace"
	case "keep-both":
		return "keep-both"
	default:
		return "skip"
	}
}

func splitNameExt(name string) (string, string) {
	ext := filepath.Ext(name)
	base := strings.TrimSuffix(name, ext)
	if base == "" {
		return name, ""
	}
	return base, ext
}

func uniqueUploadName(dir, filename string) (string, string, error) {
	target := filepath.Join(dir, filename)
	if _, err := os.Stat(target); os.IsNotExist(err) {
		return filename, target, nil
	} else if err != nil {
		return "", "", err
	}
	base, ext := splitNameExt(filename)
	for i := 1; i <= 9999; i++ {
		candidate := fmt.Sprintf("%s (%d)%s", base, i, ext)
		target = filepath.Join(dir, candidate)
		if _, err := os.Stat(target); os.IsNotExist(err) {
			return candidate, target, nil
		} else if err != nil {
			return "", "", err
		}
	}
	return "", "", fmt.Errorf("could not find available filename")
}

func replaceRelativeUploadFilename(relativePath, fallbackName, filename string) string {
	dirs, _, err := cleanRelativeUploadPath(relativePath, fallbackName)
	if err != nil || len(dirs) == 0 {
		return filename
	}
	return filepath.ToSlash(filepath.Join(append(dirs, filename)...))
}

func resolveUploadConflict(dir, filename, policy string) (finalName, finalPath string, skipped bool, err error) {
	policy = cleanConflictPolicy(policy)
	if policy == "keep-both" {
		name, path, err := uniqueUploadName(dir, filename)
		return name, path, false, err
	}

	finalPath = filepath.Join(dir, filename)
	info, statErr := os.Stat(finalPath)
	if os.IsNotExist(statErr) {
		return filename, finalPath, false, nil
	}
	if statErr != nil {
		return "", "", false, statErr
	}
	if policy == "skip" {
		return filename, finalPath, true, nil
	}
	if info.IsDir() {
		return "", "", false, fmt.Errorf("destination is a folder")
	}
	return filename, finalPath, false, nil
}

func newUploadID() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func uploadRoot(root string) string {
	return filepath.Join(root, ".cache", "uploads")
}

func uploadDir(root, uploadID string) string {
	return filepath.Join(uploadRoot(root), uploadID)
}

func uploadMetaPath(root, uploadID string) string {
	return filepath.Join(uploadDir(root, uploadID), "meta.json")
}

func writeUploadMeta(root string, meta uploadMeta) error {
	dir := uploadDir(root, meta.UploadID)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(meta, "", "  ")
	if err != nil {
		return err
	}
	tmp := filepath.Join(dir, ".meta.json.tmp")
	if err := os.WriteFile(tmp, data, 0600); err != nil {
		return err
	}
	return os.Rename(tmp, uploadMetaPath(root, meta.UploadID))
}

func readUploadMeta(root, uploadID string) (uploadMeta, error) {
	var meta uploadMeta
	if !validUploadID(uploadID) {
		return meta, fmt.Errorf("invalid upload id")
	}
	data, err := os.ReadFile(uploadMetaPath(root, uploadID))
	if err != nil {
		return meta, err
	}
	if err := json.Unmarshal(data, &meta); err != nil {
		return meta, err
	}
	if meta.UploadID != uploadID {
		return meta, fmt.Errorf("upload metadata mismatch")
	}
	return meta, nil
}

func receivedUploadChunks(root, uploadID string) ([]int, error) {
	entries, err := os.ReadDir(uploadDir(root, uploadID))
	if err != nil {
		return nil, err
	}
	received := make([]int, 0, len(entries))
	for _, entry := range entries {
		name := entry.Name()
		if entry.IsDir() || !strings.HasSuffix(name, ".part") {
			continue
		}
		idx, err := strconv.Atoi(strings.TrimSuffix(name, ".part"))
		if err != nil || idx < 0 {
			continue
		}
		received = append(received, idx)
	}
	sort.Ints(received)
	return received, nil
}

func chunkSizeLimit(cfg *config.Config) int64 {
	if cfg.MaxChunkSize > 0 {
		return cfg.MaxChunkSize
	}
	return int64(16 * 1024 * 1024)
}

func uploadTTL(cfg *config.Config) time.Duration {
	if cfg.UploadTTL > 0 {
		return cfg.UploadTTL
	}
	return 48 * time.Hour
}

func CleanupAbandonedUploads(cfg *config.Config) error {
	root := uploadRoot(cfg.Root)
	entries, err := os.ReadDir(root)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	cutoff := time.Now().UTC().Add(-uploadTTL(cfg))
	for _, entry := range entries {
		if !entry.IsDir() || !validUploadID(entry.Name()) {
			continue
		}
		dir := uploadDir(cfg.Root, entry.Name())
		remove := false
		if meta, err := readUploadMeta(cfg.Root, entry.Name()); err == nil {
			remove = meta.CreatedAt.Before(cutoff)
		} else if info, statErr := os.Stat(dir); statErr == nil {
			remove = info.ModTime().Before(cutoff)
		}
		if remove {
			if err := os.RemoveAll(dir); err != nil {
				return err
			}
		}
	}
	return nil
}

func UploadSessionCounts(cfg *config.Config) (active int, abandoned int, err error) {
	root := uploadRoot(cfg.Root)
	entries, err := os.ReadDir(root)
	if err != nil {
		if os.IsNotExist(err) {
			return 0, 0, nil
		}
		return 0, 0, err
	}
	cutoff := time.Now().UTC().Add(-uploadTTL(cfg))
	for _, entry := range entries {
		if !entry.IsDir() || !validUploadID(entry.Name()) {
			continue
		}
		if meta, metaErr := readUploadMeta(cfg.Root, entry.Name()); metaErr == nil {
			if meta.CreatedAt.Before(cutoff) {
				abandoned++
			} else {
				active++
			}
			continue
		}
		if info, statErr := os.Stat(uploadDir(cfg.Root, entry.Name())); statErr == nil && info.ModTime().Before(cutoff) {
			abandoned++
		} else {
			active++
		}
	}
	return active, abandoned, nil
}

func trashRoot(root string) string {
	return filepath.Join(root, ".trash")
}

func trashEntryDir(root, id string) string {
	return filepath.Join(trashRoot(root), id)
}

func trashEntryItemPath(root, id string) string {
	return filepath.Join(trashEntryDir(root, id), "item")
}

func trashEntryMetaPath(root, id string) string {
	return filepath.Join(trashEntryDir(root, id), "meta.json")
}

func writeTrashMeta(root string, meta trashMeta) error {
	data, err := json.MarshalIndent(meta, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(trashEntryMetaPath(root, meta.ID), data, 0600)
}

func readTrashMeta(root, id string) (trashMeta, error) {
	var meta trashMeta
	if !validUploadID(id) {
		return meta, fmt.Errorf("invalid trash id")
	}
	data, err := os.ReadFile(trashEntryMetaPath(root, id))
	if err != nil {
		return meta, err
	}
	if err := json.Unmarshal(data, &meta); err != nil {
		return meta, err
	}
	if meta.ID != id {
		return meta, fmt.Errorf("trash metadata mismatch")
	}
	return meta, nil
}

func listTrash(root string) ([]trashMeta, error) {
	entries, err := os.ReadDir(trashRoot(root))
	if err != nil {
		if os.IsNotExist(err) {
			return []trashMeta{}, nil
		}
		return nil, err
	}
	items := make([]trashMeta, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() || !validUploadID(entry.Name()) {
			continue
		}
		meta, err := readTrashMeta(root, entry.Name())
		if err == nil {
			items = append(items, meta)
		}
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].DeletedAt.After(items[j].DeletedAt)
	})
	return items, nil
}

func TrashCount(root string) (int, error) {
	items, err := listTrash(root)
	if err != nil {
		return 0, err
	}
	return len(items), nil
}

func trashRetention(cfg *config.Config) time.Duration {
	if cfg.TrashRetention > 0 {
		return cfg.TrashRetention
	}
	return 30 * 24 * time.Hour
}

func CleanupExpiredTrash(cfg *config.Config) (int, error) {
	items, err := listTrash(cfg.Root)
	if err != nil {
		return 0, err
	}
	cutoff := time.Now().UTC().Add(-trashRetention(cfg))
	removed := 0
	for _, item := range items {
		if item.DeletedAt.After(cutoff) {
			continue
		}
		if err := os.RemoveAll(trashEntryDir(cfg.Root, item.ID)); err != nil {
			return removed, err
		}
		removed++
	}
	return removed, nil
}

// moveToTrash moves a file/folder to .trash/<id>/item and stores restore metadata.
func moveToTrash(root, fullPath string) (trashMeta, error) {
	var meta trashMeta
	absRoot, err := filepath.Abs(root)
	if err != nil {
		return meta, fmt.Errorf("invalid root: %w", err)
	}
	trashDir := filepath.Join(absRoot, ".trash")
	if err := os.MkdirAll(trashDir, 0700); err != nil {
		return meta, fmt.Errorf("create trash dir: %w", err)
	}
	rel, err := filepath.Rel(absRoot, fullPath)
	if err != nil {
		return meta, fmt.Errorf("rel path: %w", err)
	}
	info, err := os.Stat(fullPath)
	if err != nil {
		return meta, fmt.Errorf("stat item: %w", err)
	}
	id, err := newUploadID()
	if err != nil {
		return meta, fmt.Errorf("generate id: %w", err)
	}
	entryDir := trashEntryDir(absRoot, id)
	if err := os.MkdirAll(entryDir, 0700); err != nil {
		return meta, fmt.Errorf("create entry dir: %w", err)
	}
	meta = trashMeta{
		ID:           id,
		OriginalPath: filepath.ToSlash(rel),
		Name:         filepath.Base(fullPath),
		IsDir:        info.IsDir(),
		Size:         info.Size(),
		DeletedAt:    time.Now().UTC(),
	}
	if err := writeTrashMeta(absRoot, meta); err != nil {
		os.RemoveAll(entryDir)
		return meta, fmt.Errorf("write meta: %w", err)
	}
	if err := os.Rename(fullPath, trashEntryItemPath(absRoot, id)); err != nil {
		os.RemoveAll(entryDir)
		return meta, fmt.Errorf("move to trash: %w", err)
	}
	return meta, nil
}

// Restore moves a file from .trash/<id>/item back to the metadata original path.
func Restore(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}
		var req struct {
			Name string `json:"name"`
			ID   string `json:"id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Bad Request", http.StatusBadRequest)
			return
		}
		id := strings.TrimSpace(req.ID)
		if id == "" {
			id = strings.TrimSpace(req.Name)
		}
		meta, err := readTrashMeta(cfg.Root, id)
		if err != nil {
			http.Error(w, "Trash entry not found", http.StatusNotFound)
			return
		}
		dstPath, err := SafePath(cfg.Root, meta.OriginalPath)
		if err != nil {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}
		if _, err := os.Stat(dstPath); err == nil {
			http.Error(w, "Restore target already exists", http.StatusConflict)
			return
		}
		if err := os.MkdirAll(filepath.Dir(dstPath), 0755); err != nil {
			http.Error(w, "Restore failed", http.StatusInternalServerError)
			return
		}
		if err := os.Rename(trashEntryItemPath(cfg.Root, id), dstPath); err != nil {
			http.Error(w, "Restore failed", http.StatusInternalServerError)
			return
		}
		os.RemoveAll(trashEntryDir(cfg.Root, id))
		storage.Append(cfg.Root, storage.ActivityEvent{User: sessionUserFromCtx(r.Context()), Action: "restore", Path: meta.OriginalPath})
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]bool{"success": true})
	}
}

// Trash handles listing and permanent cleanup of trash entries.
func Trash(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			items, err := listTrash(cfg.Root)
			if err != nil {
				http.Error(w, "Trash list failed", http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]any{"items": items})
		case http.MethodDelete:
			id := strings.TrimSpace(r.URL.Query().Get("id"))
			if id == "" {
				if err := os.RemoveAll(trashRoot(cfg.Root)); err != nil {
					http.Error(w, "Empty trash failed", http.StatusInternalServerError)
					return
				}
				w.WriteHeader(http.StatusNoContent)
				return
			}
			if !validUploadID(id) {
				http.Error(w, "Invalid trash id", http.StatusBadRequest)
				return
			}
			if _, err := readTrashMeta(cfg.Root, id); err != nil {
				http.Error(w, "Trash entry not found", http.StatusNotFound)
				return
			}
			if err := os.RemoveAll(trashEntryDir(cfg.Root, id)); err != nil {
				http.Error(w, "Delete failed", http.StatusInternalServerError)
				return
			}
			w.WriteHeader(http.StatusNoContent)
		default:
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		}
	}
}

// Cleanup runs admin-triggered maintenance jobs for transient app data.
func Cleanup(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}
		var req struct {
			Target string `json:"target"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Bad Request", http.StatusBadRequest)
			return
		}
		out := map[string]int{}
		switch req.Target {
		case "uploads":
			if err := CleanupAbandonedUploads(cfg); err != nil {
				http.Error(w, "Upload cleanup failed", http.StatusInternalServerError)
				return
			}
		case "trash":
			removed, err := CleanupExpiredTrash(cfg)
			if err != nil {
				http.Error(w, "Trash cleanup failed", http.StatusInternalServerError)
				return
			}
			out["trash_removed"] = removed
		case "all", "":
			if err := CleanupAbandonedUploads(cfg); err != nil {
				http.Error(w, "Upload cleanup failed", http.StatusInternalServerError)
				return
			}
			removed, err := CleanupExpiredTrash(cfg)
			if err != nil {
				http.Error(w, "Trash cleanup failed", http.StatusInternalServerError)
				return
			}
			out["trash_removed"] = removed
		default:
			http.Error(w, "Unknown cleanup target", http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(out)
	}
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
			info, err := os.Stat(fullPath)
			if err != nil || info.IsDir() || info.Size() > 1024*1024 {
				http.Error(w, "Not found or too large", http.StatusNotFound)
				return
			}
			data, err := io.ReadAll(io.LimitReader(r.Body, 1024*1024+1))
			if err != nil {
				http.Error(w, "Read error", http.StatusBadRequest)
				return
			}
			if len(data) > 1024*1024 {
				http.Error(w, "File too large", http.StatusRequestEntityTooLarge)
				return
			}
			if bytes.Contains(data, []byte{0}) {
				http.Error(w, "Cannot write binary file", http.StatusBadRequest)
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

// Hash streams a file and returns its SHA-256 digest on demand.
func Hash(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}
		requestPath := r.URL.Query().Get("path")
		fullPath, err := SafePath(cfg.Root, requestPath)
		if err != nil {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}
		info, err := os.Stat(fullPath)
		if err != nil || info.IsDir() {
			http.Error(w, "Not found", http.StatusNotFound)
			return
		}
		f, err := os.Open(fullPath)
		if err != nil {
			http.Error(w, "Open failed", http.StatusInternalServerError)
			return
		}
		defer f.Close()

		hasher := sha256.New()
		if _, err := io.Copy(hasher, f); err != nil {
			http.Error(w, "Hash failed", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"path":      filepath.ToSlash(strings.TrimPrefix(requestPath, "/")),
			"algorithm": "sha256",
			"hash":      hex.EncodeToString(hasher.Sum(nil)),
			"size":      info.Size(),
		})
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

		// Filter hidden files unless showHidden=true
		if r.URL.Query().Get("showHidden") != "true" {
			filtered := files[:0]
			for _, f := range files {
				if !strings.HasPrefix(f.Name, ".") {
					filtered = append(filtered, f)
				}
			}
			files = filtered
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

// Search returns filename matches across the whole storage root.
func Search(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}

		query := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("q")))
		if query == "" {
			http.Error(w, "Search query required", http.StatusBadRequest)
			return
		}

		limit := 200
		if raw := r.URL.Query().Get("limit"); raw != "" {
			if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
				limit = parsed
			}
		}
		if limit > 500 {
			limit = 500
		}
		showHidden := r.URL.Query().Get("showHidden") == "true"

		results := make([]FileInfo, 0, min(limit, 64))
		err := filepath.WalkDir(cfg.Root, func(path string, entry os.DirEntry, err error) error {
			if err != nil {
				return nil
			}
			if path == cfg.Root {
				return nil
			}

			rel, err := filepath.Rel(cfg.Root, path)
			if err != nil {
				return nil
			}
			rel = filepath.ToSlash(rel)
			parts := strings.Split(rel, "/")
			if len(parts) > 0 {
				if isAppMetadataRootName(parts[0]) {
					if entry.IsDir() {
						return filepath.SkipDir
					}
					return nil
				}
				if !showHidden && strings.HasPrefix(parts[0], ".") {
					if entry.IsDir() {
						return filepath.SkipDir
					}
					return nil
				}
			}

			if !showHidden && strings.HasPrefix(entry.Name(), ".") {
				if entry.IsDir() {
					return filepath.SkipDir
				}
				return nil
			}
			if !strings.Contains(strings.ToLower(entry.Name()), query) {
				return nil
			}
			info, err := fileInfoFromDirEntry(entry, rel)
			if err != nil {
				return nil
			}
			results = append(results, info)
			if len(results) >= limit {
				return filepath.SkipAll
			}
			return nil
		})
		if err != nil && err != filepath.SkipAll {
			http.Error(w, "Search failed", http.StatusInternalServerError)
			return
		}

		sort.Slice(results, func(i, j int) bool {
			a := strings.ToLower(results[i].Path)
			b := strings.ToLower(results[j].Path)
			return a < b
		})

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"files": results,
			"total": len(results),
		})
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

		storage.Append(cfg.Root, storage.ActivityEvent{User: sessionUserFromCtx(r.Context()), Action: "create_folder", Path: req.Path + "/" + req.Name})

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

		meta, err := moveToTrash(cfg.Root, fullPath)
		if err != nil {
			http.Error(w, "Delete failed: "+err.Error(), http.StatusInternalServerError)
			return
		}

		storage.Append(cfg.Root, storage.ActivityEvent{User: sessionUserFromCtx(r.Context()), Action: "delete", Path: req.Path})

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"message": "Item deleted", "id": meta.ID})
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

		storage.Append(cfg.Root, storage.ActivityEvent{User: sessionUserFromCtx(r.Context()), Action: "rename", Path: req.OldPath, Extra: req.NewName})

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
			if r.URL.Query().Get("format") != "zip" {
				http.Error(w, "Cannot download directory. Use ?format=zip", http.StatusBadRequest)
				return
			}
			w.Header().Set("Content-Type", "application/zip")
			w.Header().Set("Content-Disposition", `attachment; filename="`+filepath.Base(fullPath)+`.zip"`)
			zw := zip.NewWriter(w)
			defer zw.Close()
			addToZip(zw, fullPath, "")
			return
		}

		w.Header().Set("Content-Disposition", stdmime.FormatMediaType("attachment", map[string]string{
			"filename": filepath.Base(fullPath),
		}))
		http.ServeFile(w, r, fullPath)
	}
}

// Upload returns a handler that streams multipart files directly to disk.
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

		mr, err := r.MultipartReader()
		if err != nil {
			http.Error(w, "Failed to parse multipart request: "+err.Error(), http.StatusBadRequest)
			return
		}

		type Result struct {
			Name    string `json:"name"`
			Error   string `json:"error,omitempty"`
			Skipped bool   `json:"skipped,omitempty"`
			SHA256  string `json:"sha256,omitempty"`
		}
		results := make([]Result, 0, 4)
		path := "/"
		conflictPolicy := "skip"
		verifyHash := false
		relativePaths := make([]string, 0, 4)
		filesSeen := 0

		for {
			part, err := mr.NextPart()
			if err == io.EOF {
				break
			}
			if err != nil {
				http.Error(w, "Failed to read multipart data: "+err.Error(), http.StatusBadRequest)
				return
			}

			if part.FormName() == "path" {
				buf, err := io.ReadAll(io.LimitReader(part, 4096))
				part.Close()
				if err != nil {
					http.Error(w, "Failed to read upload path", http.StatusBadRequest)
					return
				}
				if p := strings.TrimSpace(string(buf)); p != "" {
					path = p
				}
				continue
			}

			if part.FormName() == "relativePath" {
				buf, err := io.ReadAll(io.LimitReader(part, 4096))
				part.Close()
				if err != nil {
					http.Error(w, "Failed to read relative path", http.StatusBadRequest)
					return
				}
				relativePaths = append(relativePaths, strings.TrimSpace(string(buf)))
				continue
			}

			if part.FormName() == "conflict" {
				buf, err := io.ReadAll(io.LimitReader(part, 64))
				part.Close()
				if err != nil {
					http.Error(w, "Failed to read conflict policy", http.StatusBadRequest)
					return
				}
				conflictPolicy = cleanConflictPolicy(string(buf))
				continue
			}

			if part.FormName() == "verifyHash" {
				buf, err := io.ReadAll(io.LimitReader(part, 16))
				part.Close()
				if err != nil {
					http.Error(w, "Failed to read integrity option", http.StatusBadRequest)
					return
				}
				verifyHash = strings.EqualFold(strings.TrimSpace(string(buf)), "true")
				continue
			}

			if part.FormName() != "files" {
				part.Close()
				continue
			}

			filesSeen++
			relativePath := ""
			if len(relativePaths) > 0 {
				relativePath = relativePaths[0]
				relativePaths = relativePaths[1:]
			}
			fallbackName := filepath.Base(part.FileName())
			targetDir, filename, activityPath, err := uploadDestination(cfg.Root, path, fallbackName, relativePath)
			res := Result{Name: fallbackName}

			if err != nil {
				if relativePath == "" {
					res.Error = "Invalid filename"
				} else {
					res.Error = "Invalid upload path"
				}
				results = append(results, res)
				part.Close()
				continue
			}
			res.Name = filename
			if err := os.MkdirAll(targetDir, 0755); err != nil {
				res.Error = "Could not create folder"
				results = append(results, res)
				part.Close()
				continue
			}

			finalName, dstPath, skipped, err := resolveUploadConflict(targetDir, filename, conflictPolicy)
			if err != nil {
				res.Error = "Could not resolve filename conflict"
				results = append(results, res)
				part.Close()
				continue
			}
			res.Name = finalName
			if skipped {
				res.Skipped = true
				results = append(results, res)
				part.Close()
				continue
			}

			tempFile, err := os.CreateTemp(targetDir, ".nodi-upload-*")
			if err != nil {
				res.Error = "Staging failed"
				results = append(results, res)
				part.Close()
				continue
			}
			tempPath := tempFile.Name()

			if _, err := io.Copy(tempFile, part); err != nil {
				part.Close()
				tempFile.Close()
				os.Remove(tempPath)
				res.Error = uploadItemErrorMessage(err, "Failed to write data")
				results = append(results, res)
				continue
			}
			part.Close()
			if err := tempFile.Close(); err != nil {
				os.Remove(tempPath)
				res.Error = uploadItemErrorMessage(err, "Failed to finalize upload")
				results = append(results, res)
				continue
			}

			if conflictPolicy == "replace" {
				if err := os.Remove(dstPath); err != nil && !os.IsNotExist(err) {
					os.Remove(tempPath)
					res.Error = "Could not replace existing file"
					results = append(results, res)
					continue
				}
			}
			if err := os.Rename(tempPath, dstPath); err != nil {
				os.Remove(tempPath)
				res.Error = uploadItemErrorMessage(err, "Finalization failed")
				results = append(results, res)
				continue
			}
			if verifyHash {
				hash, err := calculateFileSHA256(dstPath)
				if err != nil {
					res.Error = "Upload completed but SHA-256 calculation failed"
					results = append(results, res)
					continue
				}
				res.SHA256 = hash
			}

			results = append(results, res)
			if finalName != filename {
				activityPath = strings.TrimSuffix(filepath.ToSlash(filepath.Dir(activityPath)), "/") + "/" + finalName
				if !strings.HasPrefix(activityPath, "/") {
					activityPath = "/" + activityPath
				}
			}
			storage.Append(cfg.Root, storage.ActivityEvent{User: sessionUserFromCtx(r.Context()), Action: "upload", Path: activityPath})
		}

		if filesSeen == 0 {
			http.Error(w, "No files uploaded", http.StatusBadRequest)
			return
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
		if _, err := os.Stat(dstPath); err == nil {
			http.Error(w, "Destination already exists", http.StatusConflict)
			return
		}

		if os.Rename(srcPath, dstPath) != nil {
			http.Error(w, "Move failed", http.StatusInternalServerError)
			return
		}

		storage.Append(cfg.Root, storage.ActivityEvent{User: sessionUserFromCtx(r.Context()), Action: "move", Path: req.Src, Extra: req.Dst})

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
		if _, err := os.Stat(dstPath); err == nil {
			http.Error(w, "Destination already exists", http.StatusConflict)
			return
		}

		if err := copyPath(srcPath, dstPath); err != nil {
			http.Error(w, "Copy failed: "+err.Error(), http.StatusInternalServerError)
			return
		}

		storage.Append(cfg.Root, storage.ActivityEvent{User: sessionUserFromCtx(r.Context()), Action: "copy", Path: req.Src, Extra: req.Dst})

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
			Path  string   `json:"path"`
			Name  string   `json:"name"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(req.Paths) == 0 {
			http.Error(w, "Bad Request", http.StatusBadRequest)
			return
		}

		var out io.Writer = w
		var file *os.File
		if req.Name != "" {
			req.Name = strings.TrimSpace(req.Name)
			if !strings.HasSuffix(strings.ToLower(req.Name), ".zip") {
				req.Name += ".zip"
			}
			if !validName(req.Name) {
				http.Error(w, "Invalid archive name", http.StatusBadRequest)
				return
			}
			basePath, err := SafePath(cfg.Root, req.Path)
			if err != nil {
				http.Error(w, "Forbidden", http.StatusForbidden)
				return
			}
			dstPath := filepath.Join(basePath, req.Name)
			if _, err := os.Stat(dstPath); err == nil {
				http.Error(w, "Archive already exists", http.StatusConflict)
				return
			}
			file, err = os.Create(dstPath)
			if err != nil {
				http.Error(w, "Create archive failed", http.StatusInternalServerError)
				return
			}
			defer file.Close()
			out = file
		} else {
			w.Header().Set("Content-Type", "application/zip")
			w.Header().Set("Content-Disposition", `attachment; filename="download.zip"`)
		}

		zw := zip.NewWriter(out)

		for _, p := range req.Paths {
			fullPath, err := SafePath(cfg.Root, p)
			if err != nil {
				continue
			}
			addToZip(zw, fullPath, "")
		}
		if err := zw.Close(); err != nil {
			http.Error(w, "Archive finalize failed", http.StatusInternalServerError)
			return
		}
		if file != nil {
			storage.Append(cfg.Root, storage.ActivityEvent{User: sessionUserFromCtx(r.Context()), Action: "compress", Path: req.Path + "/" + req.Name})
			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(map[string]bool{"success": true})
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
		storage.Append(cfg.Root, storage.ActivityEvent{User: sessionUserFromCtx(r.Context()), Action: "create_file", Path: req.Path + "/" + req.Name})
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

// Duplicate copies a file/folder with " (copy)" suffix.
func Duplicate(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}
		var req struct{ Path string }
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Bad Request", http.StatusBadRequest)
			return
		}
		srcPath, err := SafePath(cfg.Root, req.Path)
		if err != nil {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}
		base := filepath.Base(srcPath)
		ext := filepath.Ext(base)
		name := base[:len(base)-len(ext)]
		dstPath := filepath.Join(filepath.Dir(srcPath), name+" (copy)"+ext)
		if err := copyPath(srcPath, dstPath); err != nil {
			http.Error(w, "Duplicate failed", http.StatusInternalServerError)
			return
		}
		storage.Append(cfg.Root, storage.ActivityEvent{User: sessionUserFromCtx(r.Context()), Action: "duplicate", Path: req.Path})
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]bool{"success": true})
	}
}

// Thumb generates and caches image thumbnails.
func Thumb(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		fullPath, err := SafePath(cfg.Root, r.URL.Query().Get("path"))
		if err != nil {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}
		// Determine output size
		size := 128
		switch r.URL.Query().Get("size") {
		case "lg":
			size = 256
		case "md":
			size = 128
		default:
			size = 64
		}

		// Check cache
		cacheDir := filepath.Join(cfg.Root, ".cache", "thumbs")
		os.MkdirAll(cacheDir, 0700)
		cacheKey := filepath.Base(fullPath) + "_" + fmt.Sprint(size)
		cachePath := filepath.Join(cacheDir, cacheKey+".jpg")
		if cached, err := os.ReadFile(cachePath); err == nil {
			w.Header().Set("Content-Type", "image/jpeg")
			w.Write(cached)
			return
		}

		// Decode source image
		src, err := os.Open(fullPath)
		if err != nil {
			http.Error(w, "Not found", http.StatusNotFound)
			return
		}
		defer src.Close()
		img, _, err := image.Decode(src)
		if err != nil {
			http.Error(w, "Invalid image", http.StatusBadRequest)
			return
		}

		// Resize
		bounds := img.Bounds()
		w2, h2 := size, size
		if bounds.Dx() > bounds.Dy() {
			h2 = size * bounds.Dy() / bounds.Dx()
		} else {
			w2 = size * bounds.Dx() / bounds.Dy()
		}
		dst := image.NewRGBA(image.Rect(0, 0, w2, h2))
		draw.ApproxBiLinear.Scale(dst, dst.Bounds(), img, bounds, draw.Over, nil)

		// Save to cache and serve
		var buf bytes.Buffer
		if err := jpeg.Encode(&buf, dst, &jpeg.Options{Quality: 80}); err != nil {
			http.Error(w, "Encode failed", http.StatusInternalServerError)
			return
		}
		os.WriteFile(cachePath, buf.Bytes(), 0644)

		w.Header().Set("Content-Type", "image/jpeg")
		w.Write(buf.Bytes())
	}
}

// Stream serves media files with support for HTTP range requests.
func Stream(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		fullPath, err := SafePath(cfg.Root, r.URL.Query().Get("path"))
		if err != nil {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}
		info, err := os.Stat(fullPath)
		if err != nil || info.IsDir() {
			http.Error(w, "Not found", http.StatusNotFound)
			return
		}
		http.ServeFile(w, r, fullPath)
	}
}

// UploadStart creates a server-owned resumable upload session.
func UploadStart(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}
		var req struct {
			FileName     string `json:"fileName"`
			Path         string `json:"path"`
			RelativePath string `json:"relativePath"`
			Conflict     string `json:"conflict"`
			Size         int64  `json:"size"`
			ChunkSize    int64  `json:"chunkSize"`
			TotalChunks  int    `json:"totalChunks"`
			VerifyHash   bool   `json:"verifyHash"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Bad Request", http.StatusBadRequest)
			return
		}
		_ = CleanupAbandonedUploads(cfg)

		req.FileName = filepath.Base(req.FileName)
		if !validName(req.FileName) {
			http.Error(w, "Invalid filename", http.StatusBadRequest)
			return
		}
		_, uploadName, err := cleanRelativeUploadPath(req.RelativePath, req.FileName)
		if err != nil {
			http.Error(w, "Invalid relative path", http.StatusBadRequest)
			return
		}
		req.FileName = uploadName
		if req.Path == "" {
			req.Path = "/"
		}
		if _, err := SafePath(cfg.Root, req.Path); err != nil {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}
		conflictPolicy := cleanConflictPolicy(req.Conflict)
		targetDir, targetName, _, err := uploadDestination(cfg.Root, req.Path, req.FileName, req.RelativePath)
		if err != nil {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}
		finalName, _, skipped, err := resolveUploadConflict(targetDir, targetName, conflictPolicy)
		if err != nil {
			http.Error(w, "Could not resolve filename conflict", http.StatusConflict)
			return
		}
		if skipped {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]any{
				"skipped":      true,
				"fileName":     targetName,
				"path":         req.Path,
				"relativePath": req.RelativePath,
			})
			return
		}
		req.FileName = finalName
		req.RelativePath = replaceRelativeUploadFilename(req.RelativePath, targetName, finalName)
		maxUpload := cfg.MaxUpload
		if maxUpload <= 0 {
			maxUpload = 2147483648
		}
		if req.Size <= 0 || req.Size > maxUpload {
			http.Error(w, "Invalid upload size", http.StatusBadRequest)
			return
		}
		maxChunkSize := chunkSizeLimit(cfg)
		if req.ChunkSize <= 0 || req.ChunkSize > maxChunkSize {
			http.Error(w, "Invalid chunk size", http.StatusBadRequest)
			return
		}
		expectedChunks := int((req.Size + req.ChunkSize - 1) / req.ChunkSize)
		if req.TotalChunks != expectedChunks {
			http.Error(w, "Invalid chunk count", http.StatusBadRequest)
			return
		}
		// Chunked uploads temporarily hold chunk parts on disk and then assemble
		// into a destination temp file before atomic rename. Preflight for the
		// worst normal case so uploads fail early with a human-readable error.
		if freeBytes, err := freeBytesAtPath(targetDir); err == nil {
			requiredBytes := req.Size * 2
			if req.VerifyHash {
				requiredBytes += req.ChunkSize
			}
			if requiredBytes > freeBytes {
				http.Error(w, diskFullMessage, http.StatusInsufficientStorage)
				return
			}
		}

		uploadID, err := newUploadID()
		if err != nil {
			http.Error(w, "Could not create upload", http.StatusInternalServerError)
			return
		}
		meta := uploadMeta{
			UploadID:     uploadID,
			FileName:     req.FileName,
			Path:         req.Path,
			RelativePath: req.RelativePath,
			Conflict:     conflictPolicy,
			Size:         req.Size,
			ChunkSize:    req.ChunkSize,
			TotalChunks:  req.TotalChunks,
			VerifyHash:   req.VerifyHash,
			CreatedAt:    time.Now().UTC(),
		}
		if err := writeUploadMeta(cfg.Root, meta); err != nil {
			http.Error(w, "Could not save upload", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(meta)
	}
}

// UploadStatus reports which chunks have already arrived for a resumable upload.
func UploadStatus(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}
		uploadID := r.URL.Query().Get("uploadId")
		meta, err := readUploadMeta(cfg.Root, uploadID)
		if err != nil {
			http.Error(w, "Upload not found", http.StatusNotFound)
			return
		}
		received, err := receivedUploadChunks(cfg.Root, uploadID)
		if err != nil {
			http.Error(w, "Upload not found", http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"uploadId":    uploadID,
			"fileName":    meta.FileName,
			"path":        meta.Path,
			"size":        meta.Size,
			"chunkSize":   meta.ChunkSize,
			"totalChunks": meta.TotalChunks,
			"received":    received,
		})
	}
}

// UploadSessionRouter handles upload-session actions addressed by upload id.
func UploadSessionRouter(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uploadID := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/upload/"), "/")
		if uploadID == "" {
			http.Error(w, "Upload id required", http.StatusBadRequest)
			return
		}
		if !validUploadID(uploadID) {
			http.Error(w, "Invalid upload id", http.StatusBadRequest)
			return
		}
		if r.Method != http.MethodDelete {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}
		if _, err := readUploadMeta(cfg.Root, uploadID); err != nil {
			http.Error(w, "Upload not found", http.StatusNotFound)
			return
		}
		if err := os.RemoveAll(uploadDir(cfg.Root, uploadID)); err != nil {
			http.Error(w, "Cancel failed", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

// ChunkUpload receives a single chunk of a resumable upload.
func ChunkUpload(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, chunkSizeLimit(cfg)+(1<<20))
		os.MkdirAll(uploadRoot(cfg.Root), 0700)

		mr, err := r.MultipartReader()
		if err != nil {
			http.Error(w, "Expected multipart request", http.StatusBadRequest)
			return
		}

		var flowID, chunkIdx, fileName string
		var wroteChunk bool

		for {
			part, err := mr.NextPart()
			if err == io.EOF {
				break
			}
			if err != nil {
				http.Error(w, "Failed to read chunk request", http.StatusBadRequest)
				return
			}

			switch part.FormName() {
			case "flowId":
				buf, _ := io.ReadAll(io.LimitReader(part, 128))
				flowID = strings.TrimSpace(string(buf))
				part.Close()
			case "chunkIndex":
				buf, _ := io.ReadAll(io.LimitReader(part, 32))
				chunkIdx = strings.TrimSpace(string(buf))
				part.Close()
			case "fileName":
				buf, _ := io.ReadAll(io.LimitReader(part, 512))
				fileName = string(buf)
				part.Close()
			case "chunk":
				if !validUploadID(flowID) {
					part.Close()
					http.Error(w, "Invalid upload id", http.StatusBadRequest)
					return
				}
				meta, err := readUploadMeta(cfg.Root, flowID)
				if err != nil {
					part.Close()
					http.Error(w, "Upload not found", http.StatusNotFound)
					return
				}
				idx, err := strconv.Atoi(chunkIdx)
				if err != nil || idx < 0 || idx >= meta.TotalChunks {
					part.Close()
					http.Error(w, "Invalid chunk index", http.StatusBadRequest)
					return
				}
				if fileName != "" && fileName != meta.FileName {
					part.Close()
					http.Error(w, "Filename does not match upload", http.StatusBadRequest)
					return
				}

				dir := uploadDir(cfg.Root, flowID)
				if err := os.MkdirAll(dir, 0700); err != nil {
					part.Close()
					http.Error(w, "Chunk staging failed", http.StatusInternalServerError)
					return
				}
				chunkPath := filepath.Join(dir, fmt.Sprintf("%d.part", idx))
				tmp, err := os.CreateTemp(dir, ".chunk-*")
				if err != nil {
					part.Close()
					http.Error(w, "Chunk write failed", http.StatusInternalServerError)
					return
				}
				tmpPath := tmp.Name()
				if _, err := io.Copy(tmp, part); err != nil {
					part.Close()
					tmp.Close()
					os.Remove(tmpPath)
					status := http.StatusInternalServerError
					if isDiskFullErr(err) {
						status = http.StatusInsufficientStorage
					}
					http.Error(w, uploadHTTPErrorMessage(err, "Chunk write failed"), status)
					return
				}
				part.Close()
				if err := tmp.Close(); err != nil {
					os.Remove(tmpPath)
					status := http.StatusInternalServerError
					if isDiskFullErr(err) {
						status = http.StatusInsufficientStorage
					}
					http.Error(w, uploadHTTPErrorMessage(err, "Chunk write failed"), status)
					return
				}
				if err := os.Rename(tmpPath, chunkPath); err != nil {
					os.Remove(tmpPath)
					status := http.StatusInternalServerError
					if isDiskFullErr(err) {
						status = http.StatusInsufficientStorage
					}
					http.Error(w, uploadHTTPErrorMessage(err, "Chunk write failed"), status)
					return
				}
				wroteChunk = true
			default:
				part.Close()
			}
		}

		if !wroteChunk {
			http.Error(w, "Chunk missing", http.StatusBadRequest)
			return
		}

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "received"})
	}
}

// ChunkComplete assembles all chunks into the final file and moves it to the destination.
func ChunkComplete(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}
		var req struct {
			FlowID      string `json:"flowId"`
			UploadID    string `json:"uploadId"`
			FileName    string `json:"fileName"`
			Path        string `json:"path"`
			TotalChunks int    `json:"totalChunks"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Bad Request", http.StatusBadRequest)
			return
		}
		uploadID := req.UploadID
		if uploadID == "" {
			uploadID = req.FlowID
		}
		if !validUploadID(uploadID) {
			http.Error(w, "Invalid upload id", http.StatusBadRequest)
			return
		}
		meta, err := readUploadMeta(cfg.Root, uploadID)
		if err != nil {
			http.Error(w, "Upload not found", http.StatusNotFound)
			return
		}

		targetDir, filename, activityPath, err := uploadDestination(cfg.Root, meta.Path, meta.FileName, meta.RelativePath)
		if err != nil {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}
		if err := os.MkdirAll(targetDir, 0755); err != nil {
			http.Error(w, "Create folder failed", http.StatusInternalServerError)
			return
		}

		finalName, dstPath, skipped, err := resolveUploadConflict(targetDir, filename, meta.Conflict)
		if err != nil {
			http.Error(w, "Could not resolve filename conflict", http.StatusConflict)
			return
		}
		if skipped {
			http.Error(w, "file exists", http.StatusConflict)
			return
		}

		tmp, err := os.CreateTemp(targetDir, ".nodi-upload-*")
		if err != nil {
			http.Error(w, "Create failed", http.StatusInternalServerError)
			return
		}
		tmpPath := tmp.Name()

		success := false
		defer func() {
			if !success {
				tmp.Close()
				os.Remove(tmpPath)
			}
		}()

		for i := 0; i < meta.TotalChunks; i++ {
			chunkPath := filepath.Join(uploadDir(cfg.Root, uploadID), fmt.Sprintf("%d.part", i))
			chunk, err := os.Open(chunkPath)
			if err != nil {
				http.Error(w, "Missing chunk "+fmt.Sprint(i), http.StatusBadRequest)
				return
			}
			if _, err := io.Copy(tmp, chunk); err != nil {
				chunk.Close()
				status := http.StatusInternalServerError
				if isDiskFullErr(err) {
					status = http.StatusInsufficientStorage
				}
				http.Error(w, uploadHTTPErrorMessage(err, "Failed to assemble chunk "+fmt.Sprint(i)), status)
				return
			}
			chunk.Close()
		}

		if err := tmp.Close(); err != nil {
			status := http.StatusInternalServerError
			if isDiskFullErr(err) {
				status = http.StatusInsufficientStorage
			}
			http.Error(w, uploadHTTPErrorMessage(err, "Finalize failed"), status)
			return
		}
		if cleanConflictPolicy(meta.Conflict) == "replace" {
			if err := os.Remove(dstPath); err != nil && !os.IsNotExist(err) {
				http.Error(w, "Replace failed", http.StatusInternalServerError)
				return
			}
		}
		if err := os.Rename(tmpPath, dstPath); err != nil {
			status := http.StatusInternalServerError
			if isDiskFullErr(err) {
				status = http.StatusInsufficientStorage
			}
			http.Error(w, uploadHTTPErrorMessage(err, "Finalize failed"), status)
			return
		}
		os.RemoveAll(uploadDir(cfg.Root, uploadID))
		if finalName != filename {
			activityPath = strings.TrimSuffix(filepath.ToSlash(filepath.Dir(activityPath)), "/") + "/" + finalName
			if !strings.HasPrefix(activityPath, "/") {
				activityPath = "/" + activityPath
			}
		}
		storage.Append(cfg.Root, storage.ActivityEvent{User: sessionUserFromCtx(r.Context()), Action: "upload", Path: activityPath})
		success = true
		res := map[string]any{"success": true}
		if meta.VerifyHash {
			hash, err := calculateFileSHA256(dstPath)
			if err != nil {
				http.Error(w, "Upload completed but SHA-256 calculation failed", http.StatusInternalServerError)
				return
			}
			res["sha256"] = hash
		}
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(res)
	}
}

// Recent returns files modified in the last 7 days.
func Recent(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		files, _ := ListFiles(cfg.Root)
		cutoff := time.Now().Add(-7 * 24 * time.Hour)
		recent := files[:0]
		for _, f := range files {
			if f.ModTime.After(cutoff) {
				recent = append(recent, f)
			}
		}
		sort.Slice(recent, func(i, j int) bool { return recent[i].ModTime.After(recent[j].ModTime) })
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"files": recent})
	}
}

// Favorite adds a path to the favorites list stored in .nodifav.json.
func Favorite(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		favPath := filepath.Join(cfg.Root, ".nodifav.json")
		var req struct{ Path string }
		json.NewDecoder(r.Body).Decode(&req)

		var favs []string
		data, _ := os.ReadFile(favPath)
		json.Unmarshal(data, &favs)

		if r.Method == http.MethodPost {
			for _, f := range favs {
				if f == req.Path {
					w.WriteHeader(http.StatusOK)
					json.NewEncoder(w).Encode(map[string]bool{"success": true})
					return
				}
			}
			favs = append(favs, req.Path)
		} else if r.Method == http.MethodDelete {
			filtered := favs[:0]
			for _, f := range favs {
				if f != req.Path {
					filtered = append(filtered, f)
				}
			}
			favs = filtered
		}

		d, _ := json.Marshal(favs)
		os.WriteFile(favPath, d, 0644)
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(favs)
	}
}
