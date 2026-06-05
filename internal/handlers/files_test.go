package handlers

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/Twarga/Nodi/internal/config"
)

func TestSafePath(t *testing.T) {
	tmpRoot, _ := os.MkdirTemp("", "nodi-test-*")
	defer os.RemoveAll(tmpRoot)

	// Create some dummy files/dirs
	os.MkdirAll(filepath.Join(tmpRoot, "docs/photos"), 0755)

	tests := []struct {
		name     string
		root     string
		subPath  string
		expected string // suffix
		wantErr  bool
	}{
		{"Root access", tmpRoot, "/", "", false},
		{"Subdir access", tmpRoot, "/docs", "docs", false},
		{"Nested access", tmpRoot, "docs/photos", "docs/photos", false},
		{"Traversal attempt 1", tmpRoot, "../../etc/passwd", "", true},
		{"Traversal attempt 2", tmpRoot, "/docs/../../etc/passwd", "", true},
		{"Hidden traversal", tmpRoot, "/docs/..", "", false}, // Should resolve to root
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := SafePath(tt.root, tt.subPath)
			if (err != nil) != tt.wantErr {
				t.Errorf("SafePath() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr {
				absRoot, _ := filepath.Abs(tt.root)
				expectedFull := filepath.Join(absRoot, tt.expected)
				if got != expectedFull {
					t.Errorf("SafePath() = %v, want %v", got, expectedFull)
				}
			}
		})
	}
}

func TestSafePath_RejectsSiblingPrefixEscape(t *testing.T) {
	tmpRoot, err := os.MkdirTemp("", "nodi-root-*")
	if err != nil {
		t.Fatalf("temp root: %v", err)
	}
	defer os.RemoveAll(tmpRoot)

	sibling := tmpRoot + "-evil"
	if err := os.MkdirAll(sibling, 0755); err != nil {
		t.Fatalf("create sibling: %v", err)
	}
	defer os.RemoveAll(sibling)

	if _, err := SafePath(tmpRoot, "../"+filepath.Base(sibling)); err == nil {
		t.Fatal("expected sibling prefix escape to be rejected")
	}
}

func TestSafePath_RejectsSymlinkEscape(t *testing.T) {
	tmpRoot, err := os.MkdirTemp("", "nodi-root-*")
	if err != nil {
		t.Fatalf("temp root: %v", err)
	}
	defer os.RemoveAll(tmpRoot)

	outside, err := os.MkdirTemp("", "nodi-outside-*")
	if err != nil {
		t.Fatalf("temp outside: %v", err)
	}
	defer os.RemoveAll(outside)

	if err := os.Symlink(outside, filepath.Join(tmpRoot, "outside-link")); err != nil {
		t.Fatalf("create symlink: %v", err)
	}

	if _, err := SafePath(tmpRoot, "outside-link"); err == nil {
		t.Fatal("expected symlink escape to be rejected")
	}
}

func TestMoveRejectsOverwrite(t *testing.T) {
	tmpRoot, err := os.MkdirTemp("", "nodi-move-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tmpRoot)

	if err := os.WriteFile(filepath.Join(tmpRoot, "src.txt"), []byte("src"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(tmpRoot, "dst.txt"), []byte("dst"), 0644); err != nil {
		t.Fatal(err)
	}

	body, _ := json.Marshal(map[string]string{"src": "src.txt", "dst": "dst.txt"})
	req := httptest.NewRequest(http.MethodPost, "/api/move", bytes.NewReader(body))
	rr := httptest.NewRecorder()
	Move(&config.Config{Root: tmpRoot}).ServeHTTP(rr, req)
	if rr.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d body=%s", rr.Code, rr.Body.String())
	}
}

func TestCopyRejectsOverwrite(t *testing.T) {
	tmpRoot, err := os.MkdirTemp("", "nodi-copy-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tmpRoot)

	if err := os.WriteFile(filepath.Join(tmpRoot, "src.txt"), []byte("src"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(tmpRoot, "dst.txt"), []byte("dst"), 0644); err != nil {
		t.Fatal(err)
	}

	body, _ := json.Marshal(map[string]string{"src": "src.txt", "dst": "dst.txt"})
	req := httptest.NewRequest(http.MethodPost, "/api/copy", bytes.NewReader(body))
	rr := httptest.NewRecorder()
	Copy(&config.Config{Root: tmpRoot}).ServeHTTP(rr, req)
	if rr.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d body=%s", rr.Code, rr.Body.String())
	}
}

func TestCompressCreatesArchive(t *testing.T) {
	tmpRoot, err := os.MkdirTemp("", "nodi-compress-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tmpRoot)

	if err := os.WriteFile(filepath.Join(tmpRoot, "a.txt"), []byte("a"), 0644); err != nil {
		t.Fatal(err)
	}
	body, _ := json.Marshal(map[string]interface{}{
		"paths": []string{"a.txt"},
		"path":  "/",
		"name":  "bundle.zip",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/compress", bytes.NewReader(body))
	rr := httptest.NewRecorder()
	Compress(&config.Config{Root: tmpRoot}).ServeHTTP(rr, req)
	if rr.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d body=%s", rr.Code, rr.Body.String())
	}

	zr, err := zip.OpenReader(filepath.Join(tmpRoot, "bundle.zip"))
	if err != nil {
		t.Fatal(err)
	}
	defer zr.Close()
	if len(zr.File) != 1 || zr.File[0].Name != "a.txt" {
		t.Fatalf("unexpected zip entries: %+v", zr.File)
	}
}
