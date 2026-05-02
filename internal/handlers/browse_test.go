package handlers_test

import (
	"encoding/json"
	"github.com/Twarga/Nodi/internal/config"
	"github.com/Twarga/Nodi/internal/handlers"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestBrowse_Success(t *testing.T) {
	tmpRoot, _ := os.MkdirTemp("", "nodi-browse-*")
	defer os.RemoveAll(tmpRoot)

	// Create a dummy file and a directory
	os.Mkdir(filepath.Join(tmpRoot, "folder_a"), 0755)
	os.WriteFile(filepath.Join(tmpRoot, "file_b.txt"), []byte("hello"), 0644)

	cfg := &config.Config{Root: tmpRoot}
	handler := handlers.Browse(cfg)

	req := httptest.NewRequest(http.MethodGet, "/browse?path=/", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var resp struct {
		Files []handlers.FileInfo `json:"files"`
		Total int                 `json:"total"`
	}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if resp.Total != 2 {
		t.Errorf("Expected total 2, got %d", resp.Total)
	}
	if len(resp.Files) != 2 {
		t.Errorf("Expected 2 items, got %d", len(resp.Files))
	}

	if resp.Files[0].Name != "folder_a" || !resp.Files[0].IsDir {
		t.Errorf("Expected folder_a to be first and marked as IsDir")
	}
	if resp.Files[1].Name != "file_b.txt" || resp.Files[1].IsDir {
		t.Errorf("Expected file_b.txt to be second and not marked as IsDir")
	}
}

func TestBrowse_EmptyDirectoryReturnsArray(t *testing.T) {
	tmpRoot, _ := os.MkdirTemp("", "nodi-browse-empty-*")
	defer os.RemoveAll(tmpRoot)

	cfg := &config.Config{Root: tmpRoot}
	handler := handlers.Browse(cfg)

	req := httptest.NewRequest(http.MethodGet, "/browse?path=/", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status 200, got %d", w.Code)
	}
	if body := strings.TrimSpace(w.Body.String()); body != `{"files":[],"total":0,"hasMore":false}` && body != `{"files":[],"hasMore":false,"total":0}` {
		t.Fatalf("Expected empty JSON response, got %q", body)
	}
}

func TestBrowse_Forbidden(t *testing.T) {
	tmpRoot, _ := os.MkdirTemp("", "nodi-browse-forbidden-*")
	defer os.RemoveAll(tmpRoot)

	cfg := &config.Config{Root: tmpRoot}
	handler := handlers.Browse(cfg)

	req := httptest.NewRequest(http.MethodGet, "/browse?path=../../etc/passwd", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("Expected status 403, got %d", w.Code)
	}
}

func TestBrowse_SymlinkEscapeForbidden(t *testing.T) {
	tmpRoot, _ := os.MkdirTemp("", "nodi-browse-root-*")
	defer os.RemoveAll(tmpRoot)

	outside, _ := os.MkdirTemp("", "nodi-browse-outside-*")
	defer os.RemoveAll(outside)

	if err := os.Symlink(outside, filepath.Join(tmpRoot, "outside-link")); err != nil {
		t.Fatalf("create symlink: %v", err)
	}

	cfg := &config.Config{Root: tmpRoot}
	handler := handlers.Browse(cfg)

	req := httptest.NewRequest(http.MethodGet, "/browse?path=/outside-link", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("Expected status 403, got %d", w.Code)
	}
}
