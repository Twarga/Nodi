package storage

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestActivityLogRotation(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "nodi-activity-test-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	logPath := filepath.Join(tempDir, ".nodilog.jsonl")

	// Write a small event — no rotation yet.
	Append(tempDir, ActivityEvent{User: "u1", Action: "upload", Path: "/a.txt"})
	if _, err := os.Stat(logPath); err != nil {
		t.Fatalf("expected log file to exist: %v", err)
	}

	// Pre-fill the log to exactly the rotation threshold so rotation triggers.
	f, err := os.OpenFile(logPath, os.O_APPEND|os.O_WRONLY, 0600)
	if err != nil {
		t.Fatal(err)
	}
	padding := make([]byte, activityLogMaxSize)
	for i := range padding {
		padding[i] = 'x'
	}
	written, err := f.Write(padding)
	if err != nil {
		t.Fatalf("write padding failed: %v", err)
	}
	if written != len(padding) {
		t.Fatalf("short write: %d/%d", written, len(padding))
	}
	f.Close()

	// Next append should trigger rotation.
	Append(tempDir, ActivityEvent{User: "u2", Action: "delete", Path: "/b.txt"})

	if _, err := os.Stat(logPath + ".1"); err != nil {
		t.Fatalf("expected rotated log .1 to exist: %v", err)
	}

	// Verify the new log contains the latest event.
	data, err := os.ReadFile(logPath)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(data), `"action":"delete"`) {
		t.Fatalf("expected new log to contain delete event, got:\n%s", string(data))
	}
}

func TestActivityLogMaxBackups(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "nodi-activity-backup-test-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	logPath := filepath.Join(tempDir, ".nodilog.jsonl")

	// Trigger rotation activityLogMaxBack+1 times.
	for i := 0; i < activityLogMaxBack+2; i++ {
		f, err := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
		if err != nil {
			t.Fatal(err)
		}
		padding := make([]byte, activityLogMaxSize)
		for j := range padding {
			padding[j] = 'x'
		}
		if _, err := f.Write(padding); err != nil {
			t.Fatal(err)
		}
		f.Close()
		Append(tempDir, ActivityEvent{User: "u", Action: "test", Path: "/t"})
	}

	// .1, .2, .3 should exist; .4 should not.
	for i := 1; i <= activityLogMaxBack; i++ {
		if _, err := os.Stat(fmt.Sprintf("%s.%d", logPath, i)); err != nil {
			t.Fatalf("expected backup .%d to exist: %v", i, err)
		}
	}
	if _, err := os.Stat(logPath + ".4"); err == nil {
		t.Fatal("expected backup .4 to NOT exist (max exceeded)")
	}
}
