package handlers_test

import (
	"bytes"
	"encoding/json"
	"github.com/Twarga/Nodi/internal/config"
	"github.com/Twarga/Nodi/internal/handlers"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestRename_Success(t *testing.T) {
	tmpRoot, _ := os.MkdirTemp("", "nodi-rename-*")
	defer os.RemoveAll(tmpRoot)

	// Create a file to rename
	oldPath := filepath.Join(tmpRoot, "old_name.txt")
	os.WriteFile(oldPath, []byte("hello"), 0644)

	cfg := &config.Config{Root: tmpRoot}
	handler := handlers.Rename(cfg)

	body, _ := json.Marshal(map[string]string{
		"oldPath": "/old_name.txt",
		"newName": "new_name.txt",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/rename", bytes.NewBuffer(body))
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	// Verify file was renamed
	if _, err := os.Stat(filepath.Join(tmpRoot, "new_name.txt")); os.IsNotExist(err) {
		t.Errorf("File was not renamed to new_name.txt")
	}
	if _, err := os.Stat(oldPath); !os.IsNotExist(err) {
		t.Errorf("Old file old_name.txt still exists")
	}
}

func TestRename_Conflict(t *testing.T) {
	tmpRoot, _ := os.MkdirTemp("", "nodi-rename-conflict-*")
	defer os.RemoveAll(tmpRoot)

	// Create two files
	os.WriteFile(filepath.Join(tmpRoot, "file1.txt"), []byte("1"), 0644)
	os.WriteFile(filepath.Join(tmpRoot, "file2.txt"), []byte("2"), 0644)

	cfg := &config.Config{Root: tmpRoot}
	handler := handlers.Rename(cfg)

	body, _ := json.Marshal(map[string]string{
		"oldPath": "/file1.txt",
		"newName": "file2.txt",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/rename", bytes.NewBuffer(body))
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusConflict {
		t.Errorf("Expected status 409 for conflict, got %d", w.Code)
	}
}

func TestRename_InvalidName(t *testing.T) {
	tmpRoot, _ := os.MkdirTemp("", "nodi-rename-invalid-*")
	defer os.RemoveAll(tmpRoot)

	os.WriteFile(filepath.Join(tmpRoot, "file.txt"), []byte("text"), 0644)

	cfg := &config.Config{Root: tmpRoot}
	handler := handlers.Rename(cfg)

	invalidNames := []string{"", "  ", "name/with/slash", ".", "..", "bad'name"}

	for _, name := range invalidNames {
		body, _ := json.Marshal(map[string]string{
			"oldPath": "/file.txt",
			"newName": name,
		})
		req := httptest.NewRequest(http.MethodPost, "/api/rename", bytes.NewBuffer(body))
		w := httptest.NewRecorder()

		handler.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Errorf("Expected status 400 for invalid name %q, got %d", name, w.Code)
		}
	}
}
