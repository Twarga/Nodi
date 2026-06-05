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

func TestHashFile(t *testing.T) {
	tmpRoot, err := os.MkdirTemp("", "nodi-hash-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tmpRoot)

	if err := os.WriteFile(filepath.Join(tmpRoot, "hello.txt"), []byte("hello"), 0644); err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/hash?path=hello.txt", nil)
	rr := httptest.NewRecorder()
	handlers.Hash(&config.Config{Root: tmpRoot}).ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d. Body: %s", rr.Code, rr.Body.String())
	}
	var res struct {
		Algorithm string `json:"algorithm"`
		Hash      string `json:"hash"`
		Size      int64  `json:"size"`
	}
	if err := json.NewDecoder(rr.Body).Decode(&res); err != nil {
		t.Fatal(err)
	}
	if res.Algorithm != "sha256" || res.Hash != "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824" || res.Size != 5 {
		t.Fatalf("unexpected hash response: %+v", res)
	}
}

func TestHashRejectsDirectory(t *testing.T) {
	tmpRoot, err := os.MkdirTemp("", "nodi-hash-dir-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tmpRoot)

	if err := os.Mkdir(filepath.Join(tmpRoot, "folder"), 0755); err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/hash?path=folder", nil)
	rr := httptest.NewRecorder()
	handlers.Hash(&config.Config{Root: tmpRoot}).ServeHTTP(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Fatalf("expected directory rejection status 404, got %d", rr.Code)
	}
}
