package handlers

import (
	"bytes"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"nodi/internal/config"
)

func TestUpload(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "nodi-upload-test-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	cfg := &config.Config{Root: tempDir}

	t.Run("Valid Upload", func(t *testing.T) {
		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)

		// Add path field
		_ = writer.WriteField("path", "/")

		// Add file field
		part, _ := writer.CreateFormFile("files", "test.txt")
		part.Write([]byte("hello world"))
		writer.Close()

		req := httptest.NewRequest("POST", "/api/upload", body)
		req.Header.Set("Content-Type", writer.FormDataContentType())
		rr := httptest.NewRecorder()

		handler := Upload(cfg)
		handler.ServeHTTP(rr, req)

		if rr.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d. Body: %s", rr.Code, rr.Body.String())
		}

		// Verify file exists
		expectedPath := filepath.Join(tempDir, "test.txt")
		if _, err := os.Stat(expectedPath); os.IsNotExist(err) {
			t.Errorf("file was not created at %s", expectedPath)
		}
	})

	t.Run("Common Release Filename Upload", func(t *testing.T) {
		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)
		_ = writer.WriteField("path", "/")
		filename := "[Ryuugames] RY-2755480_release (v1.0).zip"
		part, _ := writer.CreateFormFile("files", filename)
		part.Write([]byte("archive"))
		writer.Close()

		req := httptest.NewRequest("POST", "/api/upload", body)
		req.Header.Set("Content-Type", writer.FormDataContentType())
		rr := httptest.NewRecorder()

		handler := Upload(cfg)
		handler.ServeHTTP(rr, req)

		if rr.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d. Body: %s", rr.Code, rr.Body.String())
		}
		if bytes.Contains(rr.Body.Bytes(), []byte(`"error"`)) {
			t.Errorf("expected upload without per-file error, got %s", rr.Body.String())
		}
		if _, err := os.Stat(filepath.Join(tempDir, filename)); os.IsNotExist(err) {
			t.Errorf("file was not created at %s", filepath.Join(tempDir, filename))
		}
	})

	t.Run("Invalid Filename", func(t *testing.T) {
		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)
		_ = writer.WriteField("path", "/")
		part, _ := writer.CreateFormFile("files", "bad'name.txt")
		part.Write([]byte("evil"))
		writer.Close()

		req := httptest.NewRequest("POST", "/api/upload", body)
		req.Header.Set("Content-Type", writer.FormDataContentType())
		rr := httptest.NewRecorder()

		handler := Upload(cfg)
		handler.ServeHTTP(rr, req)

		// The handler should return 200 but the result list should contain an error
		// because I implemented per-file error handling.
		if rr.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", rr.Code)
		}
		if !bytes.Contains(rr.Body.Bytes(), []byte("Invalid filename")) {
			t.Errorf("expected 'Invalid filename' error in response, got %s", rr.Body.String())
		}
	})

	t.Run("Upload Limit", func(t *testing.T) {
		limitedCfg := &config.Config{Root: tempDir, MaxUpload: 10}
		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)
		_ = writer.WriteField("path", "/")
		part, _ := writer.CreateFormFile("files", "large.txt")
		part.Write([]byte("this exceeds the limit"))
		writer.Close()

		req := httptest.NewRequest("POST", "/api/upload", body)
		req.Header.Set("Content-Type", writer.FormDataContentType())
		rr := httptest.NewRecorder()

		handler := Upload(limitedCfg)
		handler.ServeHTTP(rr, req)

		if rr.Code != http.StatusBadRequest {
			t.Errorf("expected status 400, got %d", rr.Code)
		}
	})
}
