package handlers

import (
	"archive/tar"
	"archive/zip"
	"bytes"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Twarga/Nodi/internal/config"
)

func zipBytes(t *testing.T, entries map[string]string) []byte {
	t.Helper()

	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	for name, content := range entries {
		w, err := zw.Create(name)
		if err != nil {
			t.Fatalf("create zip entry: %v", err)
		}
		if _, err := io.WriteString(w, content); err != nil {
			t.Fatalf("write zip entry: %v", err)
		}
	}
	if err := zw.Close(); err != nil {
		t.Fatalf("close zip: %v", err)
	}
	return buf.Bytes()
}

func tarBytes(t *testing.T, entries map[string]string) []byte {
	t.Helper()

	var buf bytes.Buffer
	tw := tar.NewWriter(&buf)
	for name, content := range entries {
		data := []byte(content)
		if err := tw.WriteHeader(&tar.Header{
			Name: name,
			Mode: 0600,
			Size: int64(len(data)),
		}); err != nil {
			t.Fatalf("create tar entry: %v", err)
		}
		if _, err := tw.Write(data); err != nil {
			t.Fatalf("write tar entry: %v", err)
		}
	}
	if err := tw.Close(); err != nil {
		t.Fatalf("close tar: %v", err)
	}
	return buf.Bytes()
}

func multipartBackupBody(t *testing.T, fieldName, fileName string, content []byte) (*bytes.Buffer, string) {
	t.Helper()

	body := &bytes.Buffer{}
	mw := multipart.NewWriter(body)
	part, err := mw.CreateFormFile(fieldName, fileName)
	if err != nil {
		t.Fatalf("create multipart file: %v", err)
	}
	if _, err := part.Write(content); err != nil {
		t.Fatalf("write multipart file: %v", err)
	}
	if err := mw.Close(); err != nil {
		t.Fatalf("close multipart: %v", err)
	}
	return body, mw.FormDataContentType()
}

func TestRestoreTarBackupStreamsAndSkipsTraversal(t *testing.T) {
	root := t.TempDir()
	tarData := tarBytes(t, map[string]string{
		"docs/report.txt": "restored",
		"../outside.txt":  "escape",
	})
	body, contentType := multipartBackupBody(t, "file", "backup.tar", tarData)

	req := httptest.NewRequest(http.MethodPost, "/api/restore-backup", body)
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("X-Confirm", "DELETE")
	rr := httptest.NewRecorder()
	RestoreBackup(&config.Config{Root: root, MaxUpload: int64(len(tarData) + 1024)}).ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected tar restore success, got %d body=%s", rr.Code, rr.Body.String())
	}
	content, err := os.ReadFile(filepath.Join(root, "docs", "report.txt"))
	if err != nil {
		t.Fatalf("expected restored file: %v", err)
	}
	if string(content) != "restored" {
		t.Fatalf("unexpected restored content %q", string(content))
	}
	if _, err := os.Stat(filepath.Join(root, "outside.txt")); !os.IsNotExist(err) {
		t.Fatalf("expected traversal entry to be skipped, stat err=%v", err)
	}
}

func TestRestoreBackupStreamsMultipartAndSkipsTraversal(t *testing.T) {
	root := t.TempDir()
	zipData := zipBytes(t, map[string]string{
		"docs/report.txt":    "restored",
		"../outside.txt":     "escape",
		"nested/../safe.txt": "safe",
	})
	body, contentType := multipartBackupBody(t, "file", "backup.zip", zipData)

	req := httptest.NewRequest(http.MethodPost, "/api/restore-backup", body)
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("X-Confirm", "DELETE")
	rr := httptest.NewRecorder()
	RestoreBackup(&config.Config{Root: root, MaxUpload: int64(len(zipData) + 1024)}).ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected restore success, got %d body=%s", rr.Code, rr.Body.String())
	}
	content, err := os.ReadFile(filepath.Join(root, "docs", "report.txt"))
	if err != nil {
		t.Fatalf("expected restored file: %v", err)
	}
	if string(content) != "restored" {
		t.Fatalf("unexpected restored content %q", string(content))
	}
	if _, err := os.Stat(filepath.Join(root, "outside.txt")); !os.IsNotExist(err) {
		t.Fatalf("expected traversal entry to be skipped, stat err=%v", err)
	}
	matches, err := filepath.Glob(filepath.Join(root, ".nodi-restore-*"))
	if err != nil {
		t.Fatal(err)
	}
	if len(matches) > 0 {
		t.Fatalf("restore temp directory should be cleaned up, found %v", matches)
	}
}

func TestRestoreBackupRejectsMissingFilePart(t *testing.T) {
	root := t.TempDir()
	body := &bytes.Buffer{}
	mw := multipart.NewWriter(body)
	if err := mw.WriteField("other", "value"); err != nil {
		t.Fatal(err)
	}
	if err := mw.Close(); err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/restore-backup", body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.Header.Set("X-Confirm", "DELETE")
	rr := httptest.NewRecorder()
	RestoreBackup(&config.Config{Root: root, MaxUpload: 1024}).ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected bad request, got %d body=%s", rr.Code, rr.Body.String())
	}
	if !strings.Contains(rr.Body.String(), "No file uploaded") {
		t.Fatalf("expected missing file error, got %q", rr.Body.String())
	}
}

func TestBackupExcludesAppMetadata(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "visible.txt"), []byte("keep"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, ".nodishare.json"), []byte("secret"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, ".nodifav.json"), []byte("secret"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(filepath.Join(root, ".nodi-restore-old"), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, ".nodi-restore-old", "upload.zip"), []byte("secret"), 0600); err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/backup", nil)
	rr := httptest.NewRecorder()
	Backup(&config.Config{Root: root}).ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected backup success, got %d body=%s", rr.Code, rr.Body.String())
	}
	entries := map[string]bool{}
	tr := tar.NewReader(bytes.NewReader(rr.Body.Bytes()))
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatalf("read backup tar: %v", err)
		}
		entries[hdr.Name] = true
	}
	if !entries["visible.txt"] {
		t.Fatalf("expected visible file in backup, entries=%v", entries)
	}
	for _, hidden := range []string{".nodishare.json", ".nodifav.json", ".nodi-restore-old/upload.zip"} {
		if entries[hidden] {
			t.Fatalf("expected %s to be excluded from backup, entries=%v", hidden, entries)
		}
	}
}
