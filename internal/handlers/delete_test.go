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

func TestDelete_Success(t *testing.T) {
	tmpRoot, _ := os.MkdirTemp("", "nodi-delete-*")
	defer os.RemoveAll(tmpRoot)

	// Create a folder and a file to delete
	folderPath := filepath.Join(tmpRoot, "to_delete")
	os.Mkdir(folderPath, 0755)

	filePath := filepath.Join(tmpRoot, "to_delete.txt")
	os.WriteFile(filePath, []byte("goodbye"), 0644)

	cfg := &config.Config{Root: tmpRoot}
	handler := handlers.Delete(cfg)

	// Test deleting a file
	body, _ := json.Marshal(map[string]string{"path": "/to_delete.txt"})
	req := httptest.NewRequest(http.MethodPost, "/api/delete", bytes.NewBuffer(body))
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200 for file delete, got %d", w.Code)
	}
	if _, err := os.Stat(filePath); !os.IsNotExist(err) {
		t.Errorf("File to_delete.txt still exists")
	}

	// Test deleting a folder
	body, _ = json.Marshal(map[string]string{"path": "/to_delete"})
	req = httptest.NewRequest(http.MethodPost, "/api/delete", bytes.NewBuffer(body))
	w = httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200 for folder delete, got %d", w.Code)
	}
	if _, err := os.Stat(folderPath); !os.IsNotExist(err) {
		t.Errorf("Folder to_delete still exists")
	}
}

func TestDelete_Forbidden(t *testing.T) {
	tmpRoot, _ := os.MkdirTemp("", "nodi-delete-forbidden-*")
	defer os.RemoveAll(tmpRoot)

	cfg := &config.Config{Root: tmpRoot}
	handler := handlers.Delete(cfg)

	// Try deleting root
	body, _ := json.Marshal(map[string]string{"path": "/"})
	req := httptest.NewRequest(http.MethodPost, "/api/delete", bytes.NewBuffer(body))
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("Expected status 403 for root delete, got %d", w.Code)
	}

	// Try traversal deletion
	body, _ = json.Marshal(map[string]string{"path": "../../etc/passwd"})
	req = httptest.NewRequest(http.MethodPost, "/api/delete", bytes.NewBuffer(body))
	w = httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("Expected status 403 for traversal delete, got %d", w.Code)
	}
}
