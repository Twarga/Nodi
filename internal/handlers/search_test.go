package handlers_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/Twarga/Nodi/internal/config"
	"github.com/Twarga/Nodi/internal/handlers"
)

func TestSearchFindsNestedFilesAndSkipsMetadata(t *testing.T) {
	tmpRoot, err := os.MkdirTemp("", "nodi-search-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tmpRoot)

	if err := os.MkdirAll(filepath.Join(tmpRoot, "photos", "2026"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(tmpRoot, "photos", "2026", "cat-photo.jpg"), []byte("jpg"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(tmpRoot, ".cache"), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(tmpRoot, ".cache", "cat-secret.jpg"), []byte("secret"), 0600); err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/search?q=cat", nil)
	w := httptest.NewRecorder()
	handlers.Search(&config.Config{Root: tmpRoot}).ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d. Body: %s", w.Code, w.Body.String())
	}
	var resp struct {
		Files []handlers.FileInfo `json:"files"`
		Total int                 `json:"total"`
	}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatal(err)
	}
	if resp.Total != 1 || len(resp.Files) != 1 {
		t.Fatalf("expected one public result, got total=%d files=%+v", resp.Total, resp.Files)
	}
	if resp.Files[0].Path != "photos/2026/cat-photo.jpg" || resp.Files[0].ParentPath != "photos/2026" {
		t.Fatalf("unexpected search path metadata: %+v", resp.Files[0])
	}
}

func TestSearchRequiresQuery(t *testing.T) {
	tmpRoot, err := os.MkdirTemp("", "nodi-search-empty-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tmpRoot)

	req := httptest.NewRequest(http.MethodGet, "/api/search", nil)
	w := httptest.NewRecorder()
	handlers.Search(&config.Config{Root: tmpRoot}).ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", w.Code)
	}
}
