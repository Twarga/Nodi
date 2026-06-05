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
	"time"
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
	trashEntries, err := os.ReadDir(filepath.Join(tmpRoot, ".trash"))
	if err != nil || len(trashEntries) != 1 {
		t.Fatalf("expected one UUID trash entry, entries=%v err=%v", trashEntries, err)
	}
	if _, err := os.Stat(filepath.Join(tmpRoot, ".trash", trashEntries[0].Name(), "meta.json")); err != nil {
		t.Fatalf("expected trash metadata: %v", err)
	}
	if _, err := os.Stat(filepath.Join(tmpRoot, ".trash", trashEntries[0].Name(), "item")); err != nil {
		t.Fatalf("expected trashed item: %v", err)
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

func TestTrashListRestorePermanentDeleteAndEmpty(t *testing.T) {
	tmpRoot, _ := os.MkdirTemp("", "nodi-trash-*")
	defer os.RemoveAll(tmpRoot)

	if err := os.MkdirAll(filepath.Join(tmpRoot, "docs"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(tmpRoot, "docs", "note.txt"), []byte("hello"), 0644); err != nil {
		t.Fatal(err)
	}
	cfg := &config.Config{Root: tmpRoot}

	body, _ := json.Marshal(map[string]string{"path": "docs/note.txt"})
	req := httptest.NewRequest(http.MethodPost, "/api/delete", bytes.NewBuffer(body))
	rr := httptest.NewRecorder()
	handlers.Delete(cfg).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected delete status 200, got %d body=%s", rr.Code, rr.Body.String())
	}
	var del struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &del); err != nil || del.ID == "" {
		t.Fatalf("expected delete id, id=%q err=%v", del.ID, err)
	}

	listReq := httptest.NewRequest(http.MethodGet, "/api/trash", nil)
	listRR := httptest.NewRecorder()
	handlers.Trash(cfg).ServeHTTP(listRR, listReq)
	if listRR.Code != http.StatusOK || !bytes.Contains(listRR.Body.Bytes(), []byte(`"original_path":"docs/note.txt"`)) {
		t.Fatalf("expected trash listing, status=%d body=%s", listRR.Code, listRR.Body.String())
	}

	restoreBody, _ := json.Marshal(map[string]string{"id": del.ID})
	restoreReq := httptest.NewRequest(http.MethodPost, "/api/restore", bytes.NewBuffer(restoreBody))
	restoreRR := httptest.NewRecorder()
	handlers.Restore(cfg).ServeHTTP(restoreRR, restoreReq)
	if restoreRR.Code != http.StatusOK {
		t.Fatalf("expected restore status 200, got %d body=%s", restoreRR.Code, restoreRR.Body.String())
	}
	if data, err := os.ReadFile(filepath.Join(tmpRoot, "docs", "note.txt")); err != nil || string(data) != "hello" {
		t.Fatalf("expected restored file, data=%q err=%v", string(data), err)
	}

	if err := os.WriteFile(filepath.Join(tmpRoot, "delete-me.txt"), []byte("bye"), 0644); err != nil {
		t.Fatal(err)
	}
	deleteBody, _ := json.Marshal(map[string]string{"path": "delete-me.txt"})
	deleteReq := httptest.NewRequest(http.MethodPost, "/api/delete", bytes.NewBuffer(deleteBody))
	deleteRR := httptest.NewRecorder()
	handlers.Delete(cfg).ServeHTTP(deleteRR, deleteReq)
	var deleteRes struct {
		ID string `json:"id"`
	}
	_ = json.Unmarshal(deleteRR.Body.Bytes(), &deleteRes)

	permanentReq := httptest.NewRequest(http.MethodDelete, "/api/trash?id="+deleteRes.ID, nil)
	permanentRR := httptest.NewRecorder()
	handlers.Trash(cfg).ServeHTTP(permanentRR, permanentReq)
	if permanentRR.Code != http.StatusNoContent {
		t.Fatalf("expected permanent delete 204, got %d", permanentRR.Code)
	}

	if err := os.WriteFile(filepath.Join(tmpRoot, "empty-me.txt"), []byte("bye"), 0644); err != nil {
		t.Fatal(err)
	}
	emptyBody, _ := json.Marshal(map[string]string{"path": "empty-me.txt"})
	emptyDeleteReq := httptest.NewRequest(http.MethodPost, "/api/delete", bytes.NewBuffer(emptyBody))
	emptyDeleteRR := httptest.NewRecorder()
	handlers.Delete(cfg).ServeHTTP(emptyDeleteRR, emptyDeleteReq)
	emptyReq := httptest.NewRequest(http.MethodDelete, "/api/trash", nil)
	emptyRR := httptest.NewRecorder()
	handlers.Trash(cfg).ServeHTTP(emptyRR, emptyReq)
	if emptyRR.Code != http.StatusNoContent {
		t.Fatalf("expected empty trash 204, got %d", emptyRR.Code)
	}
	if entries, err := os.ReadDir(filepath.Join(tmpRoot, ".trash")); err == nil && len(entries) > 0 {
		t.Fatalf("expected empty trash, got %d entries", len(entries))
	}
}

func TestRestoreRejectsExistingDestination(t *testing.T) {
	tmpRoot, _ := os.MkdirTemp("", "nodi-trash-conflict-*")
	defer os.RemoveAll(tmpRoot)

	if err := os.WriteFile(filepath.Join(tmpRoot, "note.txt"), []byte("old"), 0644); err != nil {
		t.Fatal(err)
	}
	cfg := &config.Config{Root: tmpRoot}

	deleteBody, _ := json.Marshal(map[string]string{"path": "note.txt"})
	deleteReq := httptest.NewRequest(http.MethodPost, "/api/delete", bytes.NewBuffer(deleteBody))
	deleteRR := httptest.NewRecorder()
	handlers.Delete(cfg).ServeHTTP(deleteRR, deleteReq)
	if deleteRR.Code != http.StatusOK {
		t.Fatalf("expected delete status 200, got %d body=%s", deleteRR.Code, deleteRR.Body.String())
	}
	var deleteRes struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(deleteRR.Body.Bytes(), &deleteRes); err != nil || deleteRes.ID == "" {
		t.Fatalf("expected delete id, id=%q err=%v", deleteRes.ID, err)
	}

	if err := os.WriteFile(filepath.Join(tmpRoot, "note.txt"), []byte("new"), 0644); err != nil {
		t.Fatal(err)
	}

	restoreBody, _ := json.Marshal(map[string]string{"id": deleteRes.ID})
	restoreReq := httptest.NewRequest(http.MethodPost, "/api/restore", bytes.NewBuffer(restoreBody))
	restoreRR := httptest.NewRecorder()
	handlers.Restore(cfg).ServeHTTP(restoreRR, restoreReq)
	if restoreRR.Code != http.StatusConflict {
		t.Fatalf("expected restore conflict 409, got %d body=%s", restoreRR.Code, restoreRR.Body.String())
	}
	if data, err := os.ReadFile(filepath.Join(tmpRoot, "note.txt")); err != nil || string(data) != "new" {
		t.Fatalf("expected existing destination to remain unchanged, data=%q err=%v", string(data), err)
	}
	if _, err := os.Stat(filepath.Join(tmpRoot, ".trash", deleteRes.ID, "item")); err != nil {
		t.Fatalf("expected trashed item to remain after failed restore, err=%v", err)
	}
}

func TestCleanupExpiredTrash(t *testing.T) {
	tmpRoot, _ := os.MkdirTemp("", "nodi-trash-cleanup-*")
	defer os.RemoveAll(tmpRoot)

	cfg := &config.Config{Root: tmpRoot, TrashRetention: time.Hour}
	oldID := "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	freshID := "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
	for id, deletedAt := range map[string]time.Time{
		oldID:   time.Now().UTC().Add(-2 * time.Hour),
		freshID: time.Now().UTC(),
	} {
		if err := os.MkdirAll(filepath.Join(tmpRoot, ".trash", id), 0700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(tmpRoot, ".trash", id, "item"), []byte(id), 0600); err != nil {
			t.Fatal(err)
		}
		meta := map[string]any{
			"id":            id,
			"original_path": id + ".txt",
			"name":          id + ".txt",
			"is_dir":        false,
			"size":          3,
			"deleted_at":    deletedAt,
		}
		data, _ := json.Marshal(meta)
		if err := os.WriteFile(filepath.Join(tmpRoot, ".trash", id, "meta.json"), data, 0600); err != nil {
			t.Fatal(err)
		}
	}

	removed, err := handlers.CleanupExpiredTrash(cfg)
	if err != nil {
		t.Fatal(err)
	}
	if removed != 1 {
		t.Fatalf("expected one removed item, got %d", removed)
	}
	if _, err := os.Stat(filepath.Join(tmpRoot, ".trash", oldID)); !os.IsNotExist(err) {
		t.Fatalf("expected old trash removed, err=%v", err)
	}
	if _, err := os.Stat(filepath.Join(tmpRoot, ".trash", freshID)); err != nil {
		t.Fatalf("expected fresh trash to remain, err=%v", err)
	}
}

func TestCleanupEndpoint(t *testing.T) {
	tmpRoot, _ := os.MkdirTemp("", "nodi-cleanup-endpoint-*")
	defer os.RemoveAll(tmpRoot)

	cfg := &config.Config{Root: tmpRoot, TrashRetention: time.Hour}
	id := "cccccccccccccccccccccccccccccccc"
	if err := os.MkdirAll(filepath.Join(tmpRoot, ".trash", id), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(tmpRoot, ".trash", id, "item"), []byte("old"), 0600); err != nil {
		t.Fatal(err)
	}
	data, _ := json.Marshal(map[string]any{
		"id":            id,
		"original_path": "old.txt",
		"name":          "old.txt",
		"is_dir":        false,
		"size":          3,
		"deleted_at":    time.Now().UTC().Add(-2 * time.Hour),
	})
	if err := os.WriteFile(filepath.Join(tmpRoot, ".trash", id, "meta.json"), data, 0600); err != nil {
		t.Fatal(err)
	}

	body, _ := json.Marshal(map[string]string{"target": "trash"})
	req := httptest.NewRequest(http.MethodPost, "/api/cleanup", bytes.NewBuffer(body))
	rr := httptest.NewRecorder()
	handlers.Cleanup(cfg).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected cleanup status 200, got %d body=%s", rr.Code, rr.Body.String())
	}
	if !bytes.Contains(rr.Body.Bytes(), []byte(`"trash_removed":1`)) {
		t.Fatalf("expected removed count, got %s", rr.Body.String())
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
