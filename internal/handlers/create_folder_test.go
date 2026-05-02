package handlers_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"nodi/internal/config"
	"nodi/internal/handlers"
	"os"
	"path/filepath"
	"testing"
)

func TestCreateFolder_Success(t *testing.T) {
	tmpRoot, _ := os.MkdirTemp("", "nodi-create-folder-*")
	defer os.RemoveAll(tmpRoot)

	cfg := &config.Config{Root: tmpRoot}
	handler := handlers.CreateFolder(cfg)

	body, _ := json.Marshal(map[string]string{
		"path": "/",
		"name": "new_photos",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/folder/create", bytes.NewBuffer(body))
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("Expected status 201, got %d", w.Code)
	}

	// Verify folder exists
	if _, err := os.Stat(filepath.Join(tmpRoot, "new_photos")); os.IsNotExist(err) {
		t.Errorf("Folder was not created")
	}
}

func TestCreateFolder_InvalidName(t *testing.T) {
	tmpRoot, _ := os.MkdirTemp("", "nodi-create-folder-invalid-*")
	defer os.RemoveAll(tmpRoot)

	cfg := &config.Config{Root: tmpRoot}
	handler := handlers.CreateFolder(cfg)

	invalidNames := []string{"", "  ", "folder/slash", "../outside", ".", "..", "bad<name", `bad"name`}

	for _, name := range invalidNames {
		body, _ := json.Marshal(map[string]string{
			"path": "/",
			"name": name,
		})
		req := httptest.NewRequest(http.MethodPost, "/api/folder/create", bytes.NewBuffer(body))
		w := httptest.NewRecorder()

		handler.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest && w.Code != http.StatusForbidden {
			t.Errorf("Expected status 400 or 403 for name %q, got %d", name, w.Code)
		}
	}
}
