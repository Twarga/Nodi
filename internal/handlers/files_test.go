package handlers

import (
	"os"
	"path/filepath"
	"testing"
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
