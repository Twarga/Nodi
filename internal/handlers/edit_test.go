package handlers_test

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Twarga/Nodi/internal/config"
	"github.com/Twarga/Nodi/internal/handlers"
)

func TestEditTextFile(t *testing.T) {
	tmpRoot, err := os.MkdirTemp("", "nodi-edit-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tmpRoot)

	path := filepath.Join(tmpRoot, "notes.txt")
	if err := os.WriteFile(path, []byte("old"), 0644); err != nil {
		t.Fatal(err)
	}
	cfg := &config.Config{Root: tmpRoot}

	putReq := httptest.NewRequest(http.MethodPut, "/api/edit?path=notes.txt", strings.NewReader("new text"))
	putRR := httptest.NewRecorder()
	handlers.Edit(cfg).ServeHTTP(putRR, putReq)
	if putRR.Code != http.StatusOK {
		t.Fatalf("expected save status 200, got %d. Body: %s", putRR.Code, putRR.Body.String())
	}
	if data, err := os.ReadFile(path); err != nil || string(data) != "new text" {
		t.Fatalf("expected updated file, data=%q err=%v", string(data), err)
	}

	getReq := httptest.NewRequest(http.MethodGet, "/api/edit?path=notes.txt", nil)
	getRR := httptest.NewRecorder()
	handlers.Edit(cfg).ServeHTTP(getRR, getReq)
	if getRR.Code != http.StatusOK || getRR.Body.String() != "new text" {
		t.Fatalf("expected saved text from GET, status=%d body=%q", getRR.Code, getRR.Body.String())
	}
}

func TestEditRejectsBinaryAndOversizedWrites(t *testing.T) {
	tmpRoot, err := os.MkdirTemp("", "nodi-edit-reject-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tmpRoot)

	path := filepath.Join(tmpRoot, "notes.txt")
	if err := os.WriteFile(path, []byte("safe"), 0644); err != nil {
		t.Fatal(err)
	}
	cfg := &config.Config{Root: tmpRoot}

	binaryReq := httptest.NewRequest(http.MethodPut, "/api/edit?path=notes.txt", bytes.NewReader([]byte{'a', 0, 'b'}))
	binaryRR := httptest.NewRecorder()
	handlers.Edit(cfg).ServeHTTP(binaryRR, binaryReq)
	if binaryRR.Code != http.StatusBadRequest {
		t.Fatalf("expected binary rejection status 400, got %d", binaryRR.Code)
	}

	largeReq := httptest.NewRequest(http.MethodPut, "/api/edit?path=notes.txt", strings.NewReader(strings.Repeat("x", 1024*1024+1)))
	largeRR := httptest.NewRecorder()
	handlers.Edit(cfg).ServeHTTP(largeRR, largeReq)
	if largeRR.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("expected oversized rejection status 413, got %d", largeRR.Code)
	}
}
