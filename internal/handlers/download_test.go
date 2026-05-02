package handlers_test

import (
	"net/http"
	"net/http/httptest"
	"nodi/internal/config"
	"nodi/internal/handlers"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestDownload_Success(t *testing.T) {
	tmpRoot, err := os.MkdirTemp("", "nodi-download-*")
	if err != nil {
		t.Fatalf("temp root: %v", err)
	}
	defer os.RemoveAll(tmpRoot)

	if err := os.WriteFile(filepath.Join(tmpRoot, "file.txt"), []byte("hello"), 0644); err != nil {
		t.Fatalf("write file: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/download?path=/file.txt", nil)
	w := httptest.NewRecorder()

	handlers.Download(&config.Config{Root: tmpRoot}).ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", w.Code, w.Body.String())
	}
	if body := w.Body.String(); body != "hello" {
		t.Fatalf("expected downloaded body, got %q", body)
	}
	if disposition := w.Header().Get("Content-Disposition"); !strings.Contains(disposition, "attachment") {
		t.Fatalf("expected attachment disposition, got %q", disposition)
	}
}

func TestDownload_RejectsDirectory(t *testing.T) {
	tmpRoot, err := os.MkdirTemp("", "nodi-download-*")
	if err != nil {
		t.Fatalf("temp root: %v", err)
	}
	defer os.RemoveAll(tmpRoot)

	if err := os.Mkdir(filepath.Join(tmpRoot, "folder"), 0755); err != nil {
		t.Fatalf("create folder: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/download?path=/folder", nil)
	w := httptest.NewRecorder()

	handlers.Download(&config.Config{Root: tmpRoot}).ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", w.Code)
	}
}

func TestDownload_RejectsTraversal(t *testing.T) {
	tmpRoot, err := os.MkdirTemp("", "nodi-download-*")
	if err != nil {
		t.Fatalf("temp root: %v", err)
	}
	defer os.RemoveAll(tmpRoot)

	req := httptest.NewRequest(http.MethodGet, "/api/download?path=../../etc/passwd", nil)
	w := httptest.NewRecorder()

	handlers.Download(&config.Config{Root: tmpRoot}).ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected status 403, got %d", w.Code)
	}
}
