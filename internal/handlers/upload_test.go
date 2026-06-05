package handlers

import (
	"bytes"
	"crypto/sha256"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"syscall"
	"testing"
	"time"

	"github.com/Twarga/Nodi/internal/config"
)

type generatedReader struct {
	pos int64
}

func newGeneratedReader(offset int64) *generatedReader {
	return &generatedReader{pos: offset}
}

func (r *generatedReader) Read(p []byte) (int, error) {
	for i := range p {
		p[i] = byte((r.pos*31 + 17) % 251)
		r.pos++
	}
	return len(p), nil
}

func hashGenerated(t *testing.T, size int64) [32]byte {
	t.Helper()
	h := sha256.New()
	if _, err := io.Copy(h, io.LimitReader(newGeneratedReader(0), size)); err != nil {
		t.Fatal(err)
	}
	var sum [32]byte
	copy(sum[:], h.Sum(nil))
	return sum
}

func hashFile(t *testing.T, path string) [32]byte {
	t.Helper()
	f, err := os.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		t.Fatal(err)
	}
	var sum [32]byte
	copy(sum[:], h.Sum(nil))
	return sum
}

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
		part, _ := writer.CreateFormFile("files", "bad\\name.txt")
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

	t.Run("Relative Path Upload Preserves Folder", func(t *testing.T) {
		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)
		_ = writer.WriteField("path", "/")
		_ = writer.WriteField("relativePath", "folder/sub/test.txt")
		part, _ := writer.CreateFormFile("files", "test.txt")
		part.Write([]byte("nested"))
		writer.Close()

		req := httptest.NewRequest("POST", "/api/upload", body)
		req.Header.Set("Content-Type", writer.FormDataContentType())
		rr := httptest.NewRecorder()

		handler := Upload(cfg)
		handler.ServeHTTP(rr, req)

		if rr.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d. Body: %s", rr.Code, rr.Body.String())
		}
		expectedPath := filepath.Join(tempDir, "folder", "sub", "test.txt")
		if data, err := os.ReadFile(expectedPath); err != nil || string(data) != "nested" {
			t.Errorf("expected nested file at %s, got data=%q err=%v", expectedPath, string(data), err)
		}
	})
}

func TestUploadStreamsGeneratedLargeFile(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "nodi-upload-stream-large-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	const size int64 = 8<<20 + 12345
	cfg := &config.Config{Root: tempDir, MaxUpload: size + 1<<20}
	pr, pw := io.Pipe()
	writer := multipart.NewWriter(pw)
	writeErr := make(chan error, 1)

	go func() {
		defer close(writeErr)
		if err := writer.WriteField("path", "/"); err != nil {
			writeErr <- err
			pw.CloseWithError(err)
			return
		}
		part, err := writer.CreateFormFile("files", "generated-large.bin")
		if err != nil {
			writeErr <- err
			pw.CloseWithError(err)
			return
		}
		if _, err := io.Copy(part, io.LimitReader(newGeneratedReader(0), size)); err != nil {
			writeErr <- err
			pw.CloseWithError(err)
			return
		}
		if err := writer.Close(); err != nil {
			writeErr <- err
			pw.CloseWithError(err)
			return
		}
		writeErr <- pw.Close()
	}()

	req := httptest.NewRequest(http.MethodPost, "/api/upload", pr)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	rr := httptest.NewRecorder()
	Upload(cfg).ServeHTTP(rr, req)
	if err := <-writeErr; err != nil {
		t.Fatalf("failed to stream multipart body: %v", err)
	}
	if rr.Code != http.StatusOK {
		t.Fatalf("expected upload status 200, got %d body=%s", rr.Code, rr.Body.String())
	}
	dst := filepath.Join(tempDir, "generated-large.bin")
	info, err := os.Stat(dst)
	if err != nil {
		t.Fatal(err)
	}
	if info.Size() != size {
		t.Fatalf("expected uploaded size %d, got %d", size, info.Size())
	}
	if got, want := hashFile(t, dst), hashGenerated(t, size); got != want {
		t.Fatalf("uploaded generated stream hash mismatch")
	}
	if matches, err := filepath.Glob(filepath.Join(tempDir, ".nodi-upload-*")); err != nil || len(matches) != 0 {
		t.Fatalf("expected no staged upload files left, matches=%v err=%v", matches, err)
	}
}

func TestUploadConflictPolicies(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "nodi-upload-conflict-test-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	cfg := &config.Config{Root: tempDir}

	upload := func(name, data, policy string) []byte {
		t.Helper()
		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)
		_ = writer.WriteField("path", "/")
		_ = writer.WriteField("conflict", policy)
		part, err := writer.CreateFormFile("files", name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := part.Write([]byte(data)); err != nil {
			t.Fatal(err)
		}
		if err := writer.Close(); err != nil {
			t.Fatal(err)
		}
		req := httptest.NewRequest(http.MethodPost, "/api/upload", body)
		req.Header.Set("Content-Type", writer.FormDataContentType())
		rr := httptest.NewRecorder()
		Upload(cfg).ServeHTTP(rr, req)
		if rr.Code != http.StatusOK {
			t.Fatalf("expected status 200, got %d. Body: %s", rr.Code, rr.Body.String())
		}
		return rr.Body.Bytes()
	}

	upload("dupe.txt", "original", "skip")

	body := upload("dupe.txt", "second", "skip")
	if !bytes.Contains(body, []byte(`"skipped":true`)) {
		t.Fatalf("expected skipped result, got %s", string(body))
	}
	if data, err := os.ReadFile(filepath.Join(tempDir, "dupe.txt")); err != nil || string(data) != "original" {
		t.Fatalf("expected original file to remain, data=%q err=%v", string(data), err)
	}

	body = upload("dupe.txt", "copy", "keep-both")
	if !bytes.Contains(body, []byte(`dupe (1).txt`)) {
		t.Fatalf("expected keep-both renamed result, got %s", string(body))
	}
	if data, err := os.ReadFile(filepath.Join(tempDir, "dupe (1).txt")); err != nil || string(data) != "copy" {
		t.Fatalf("expected renamed copy, data=%q err=%v", string(data), err)
	}

	upload("dupe.txt", "replacement", "replace")
	if data, err := os.ReadFile(filepath.Join(tempDir, "dupe.txt")); err != nil || string(data) != "replacement" {
		t.Fatalf("expected replacement file, data=%q err=%v", string(data), err)
	}
}

func TestChunkUploadAndComplete(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "nodi-chunk-upload-test-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	cfg := &config.Config{Root: tempDir}
	flowID := "0123456789abcdef0123456789abcdef"
	if err := writeUploadMeta(tempDir, uploadMeta{
		UploadID:     flowID,
		FileName:     "big.bin",
		Path:         "/",
		RelativePath: "nested/big.bin",
		Size:         11,
		ChunkSize:    6,
		TotalChunks:  2,
		CreatedAt:    time.Now().UTC(),
	}); err != nil {
		t.Fatal(err)
	}

	uploadChunk := func(index string, data string) {
		t.Helper()
		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)
		_ = writer.WriteField("flowId", flowID)
		_ = writer.WriteField("chunkIndex", index)
		_ = writer.WriteField("fileName", "big.bin")
		part, err := writer.CreateFormFile("chunk", "chunk")
		if err != nil {
			t.Fatal(err)
		}
		if _, err := part.Write([]byte(data)); err != nil {
			t.Fatal(err)
		}
		if err := writer.Close(); err != nil {
			t.Fatal(err)
		}

		req := httptest.NewRequest(http.MethodPost, "/api/upload/chunk", body)
		req.Header.Set("Content-Type", writer.FormDataContentType())
		rr := httptest.NewRecorder()
		ChunkUpload(cfg).ServeHTTP(rr, req)
		if rr.Code != http.StatusOK {
			t.Fatalf("expected chunk upload status 200, got %d. Body: %s", rr.Code, rr.Body.String())
		}
	}

	uploadChunk("0", "hello ")
	uploadChunk("1", "world")

	completeBody, err := json.Marshal(map[string]any{
		"flowId":      flowID,
		"fileName":    "big.bin",
		"path":        "/",
		"totalChunks": 2,
	})
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/upload/complete", bytes.NewReader(completeBody))
	rr := httptest.NewRecorder()
	ChunkComplete(cfg).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected complete status 200, got %d. Body: %s", rr.Code, rr.Body.String())
	}

	got, err := os.ReadFile(filepath.Join(tempDir, "nested", "big.bin"))
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != "hello world" {
		t.Fatalf("assembled file mismatch: %q", string(got))
	}
	if _, err := os.Stat(filepath.Join(tempDir, ".cache", "uploads", flowID)); !os.IsNotExist(err) {
		t.Fatalf("expected chunk directory cleanup, got err=%v", err)
	}
}

func TestChunkUploadGeneratedStreamAssemblesLargeFile(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "nodi-chunk-generated-large-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	const (
		size      int64 = 5<<20 + 777
		chunkSize int64 = 1 << 20
	)
	totalChunks := int((size + chunkSize - 1) / chunkSize)
	cfg := &config.Config{Root: tempDir, MaxUpload: size + 1<<20, MaxChunkSize: chunkSize}
	uploadID := "cccccccccccccccccccccccccccccccc"
	if err := writeUploadMeta(tempDir, uploadMeta{
		UploadID:    uploadID,
		FileName:    "chunked-large.bin",
		Path:        "/",
		Size:        size,
		ChunkSize:   chunkSize,
		TotalChunks: totalChunks,
		CreatedAt:   time.Now().UTC(),
	}); err != nil {
		t.Fatal(err)
	}

	for i := 0; i < totalChunks; i++ {
		start := int64(i) * chunkSize
		length := chunkSize
		if remaining := size - start; remaining < length {
			length = remaining
		}
		pr, pw := io.Pipe()
		writer := multipart.NewWriter(pw)
		writeErr := make(chan error, 1)
		go func(index int, offset, n int64) {
			defer close(writeErr)
			_ = writer.WriteField("flowId", uploadID)
			_ = writer.WriteField("chunkIndex", strconv.Itoa(index))
			_ = writer.WriteField("fileName", "chunked-large.bin")
			part, err := writer.CreateFormFile("chunk", "chunk")
			if err != nil {
				writeErr <- err
				pw.CloseWithError(err)
				return
			}
			if _, err := io.Copy(part, io.LimitReader(newGeneratedReader(offset), n)); err != nil {
				writeErr <- err
				pw.CloseWithError(err)
				return
			}
			if err := writer.Close(); err != nil {
				writeErr <- err
				pw.CloseWithError(err)
				return
			}
			writeErr <- pw.Close()
		}(i, start, length)

		req := httptest.NewRequest(http.MethodPost, "/api/upload/chunk", pr)
		req.Header.Set("Content-Type", writer.FormDataContentType())
		rr := httptest.NewRecorder()
		ChunkUpload(cfg).ServeHTTP(rr, req)
		if err := <-writeErr; err != nil {
			t.Fatalf("failed to stream chunk %d: %v", i, err)
		}
		if rr.Code != http.StatusOK {
			t.Fatalf("expected chunk %d status 200, got %d body=%s", i, rr.Code, rr.Body.String())
		}
	}

	completeBody, err := json.Marshal(map[string]any{
		"uploadId":    uploadID,
		"fileName":    "chunked-large.bin",
		"path":        "/",
		"totalChunks": totalChunks,
	})
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/upload/complete", bytes.NewReader(completeBody))
	rr := httptest.NewRecorder()
	ChunkComplete(cfg).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected complete status 200, got %d body=%s", rr.Code, rr.Body.String())
	}

	dst := filepath.Join(tempDir, "chunked-large.bin")
	info, err := os.Stat(dst)
	if err != nil {
		t.Fatal(err)
	}
	if info.Size() != size {
		t.Fatalf("expected assembled size %d, got %d", size, info.Size())
	}
	if got, want := hashFile(t, dst), hashGenerated(t, size); got != want {
		t.Fatalf("assembled generated stream hash mismatch")
	}
	if _, err := os.Stat(uploadDir(tempDir, uploadID)); !os.IsNotExist(err) {
		t.Fatalf("expected upload session cleanup, got err=%v", err)
	}
}

func TestChunkCompleteMissingChunkDoesNotCreateFinalFile(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "nodi-chunk-missing-final-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	cfg := &config.Config{Root: tempDir, MaxChunkSize: 8}
	uploadID := "dddddddddddddddddddddddddddddddd"
	if err := writeUploadMeta(tempDir, uploadMeta{
		UploadID:    uploadID,
		FileName:    "interrupted.bin",
		Path:        "/",
		Size:        11,
		ChunkSize:   6,
		TotalChunks: 2,
		CreatedAt:   time.Now().UTC(),
	}); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(uploadDir(tempDir, uploadID), "0.part"), []byte("hello "), 0600); err != nil {
		t.Fatal(err)
	}

	completeBody, err := json.Marshal(map[string]any{
		"uploadId":    uploadID,
		"fileName":    "interrupted.bin",
		"path":        "/",
		"totalChunks": 2,
	})
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/upload/complete", bytes.NewReader(completeBody))
	rr := httptest.NewRecorder()
	ChunkComplete(cfg).ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected missing chunk status 400, got %d body=%s", rr.Code, rr.Body.String())
	}
	if _, err := os.Stat(filepath.Join(tempDir, "interrupted.bin")); !os.IsNotExist(err) {
		t.Fatalf("final file should not exist after interrupted assembly, err=%v", err)
	}
	if matches, err := filepath.Glob(filepath.Join(tempDir, ".nodi-upload-*")); err != nil || len(matches) != 0 {
		t.Fatalf("expected interrupted temp file cleanup, matches=%v err=%v", matches, err)
	}
	if _, err := os.Stat(filepath.Join(uploadDir(tempDir, uploadID), "0.part")); err != nil {
		t.Fatalf("upload session should remain resumable after failed complete, err=%v", err)
	}
}

func TestChunkUploadRejectsTraversalFlowID(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "nodi-chunk-traversal-test-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	cfg := &config.Config{Root: tempDir}
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	_ = writer.WriteField("flowId", "../../evil")
	_ = writer.WriteField("chunkIndex", "0")
	_ = writer.WriteField("fileName", "big.bin")
	part, err := writer.CreateFormFile("chunk", "chunk")
	if err != nil {
		t.Fatal(err)
	}
	_, _ = part.Write([]byte("data"))
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/upload/chunk", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	rr := httptest.NewRecorder()
	ChunkUpload(cfg).ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d. Body: %s", rr.Code, rr.Body.String())
	}
}

func TestUploadSessionStartStatusAndCancel(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "nodi-upload-session-test-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	cfg := &config.Config{Root: tempDir, MaxChunkSize: 8}
	startBody, err := json.Marshal(map[string]any{
		"fileName":    "movie.mkv",
		"path":        "/",
		"size":        11,
		"chunkSize":   6,
		"totalChunks": 2,
	})
	if err != nil {
		t.Fatal(err)
	}
	startReq := httptest.NewRequest(http.MethodPost, "/api/upload/start", bytes.NewReader(startBody))
	startRR := httptest.NewRecorder()
	UploadStart(cfg).ServeHTTP(startRR, startReq)
	if startRR.Code != http.StatusOK {
		t.Fatalf("expected start status 200, got %d. Body: %s", startRR.Code, startRR.Body.String())
	}
	var meta uploadMeta
	if err := json.Unmarshal(startRR.Body.Bytes(), &meta); err != nil {
		t.Fatal(err)
	}
	if !validUploadID(meta.UploadID) || meta.FileName != "movie.mkv" || meta.TotalChunks != 2 {
		t.Fatalf("unexpected upload metadata: %+v", meta)
	}

	if err := os.WriteFile(filepath.Join(uploadDir(tempDir, meta.UploadID), "0.part"), []byte("hello "), 0600); err != nil {
		t.Fatal(err)
	}

	statusReq := httptest.NewRequest(http.MethodGet, "/api/upload/status?uploadId="+meta.UploadID, nil)
	statusRR := httptest.NewRecorder()
	UploadStatus(cfg).ServeHTTP(statusRR, statusReq)
	if statusRR.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d. Body: %s", statusRR.Code, statusRR.Body.String())
	}
	if !bytes.Contains(statusRR.Body.Bytes(), []byte(`"received":[0]`)) {
		t.Fatalf("expected received chunk 0, got %s", statusRR.Body.String())
	}

	cancelReq := httptest.NewRequest(http.MethodDelete, "/api/upload/"+meta.UploadID, nil)
	cancelRR := httptest.NewRecorder()
	UploadSessionRouter(cfg).ServeHTTP(cancelRR, cancelReq)
	if cancelRR.Code != http.StatusNoContent {
		t.Fatalf("expected cancel status 204, got %d. Body: %s", cancelRR.Code, cancelRR.Body.String())
	}
	if _, err := os.Stat(uploadDir(tempDir, meta.UploadID)); !os.IsNotExist(err) {
		t.Fatalf("expected upload session cleanup, got err=%v", err)
	}
}

func TestUploadStartConflictPolicies(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "nodi-upload-session-conflict-test-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	if err := os.WriteFile(filepath.Join(tempDir, "movie.mkv"), []byte("existing"), 0644); err != nil {
		t.Fatal(err)
	}
	cfg := &config.Config{Root: tempDir, MaxChunkSize: 8}

	start := func(policy string) *httptest.ResponseRecorder {
		t.Helper()
		body, err := json.Marshal(map[string]any{
			"fileName":     "movie.mkv",
			"path":         "/",
			"relativePath": "movie.mkv",
			"conflict":     policy,
			"size":         11,
			"chunkSize":    6,
			"totalChunks":  2,
		})
		if err != nil {
			t.Fatal(err)
		}
		req := httptest.NewRequest(http.MethodPost, "/api/upload/start", bytes.NewReader(body))
		rr := httptest.NewRecorder()
		UploadStart(cfg).ServeHTTP(rr, req)
		return rr
	}

	skipRR := start("skip")
	if skipRR.Code != http.StatusOK || !bytes.Contains(skipRR.Body.Bytes(), []byte(`"skipped":true`)) {
		t.Fatalf("expected skipped start response, got status=%d body=%s", skipRR.Code, skipRR.Body.String())
	}

	keepBothRR := start("keep-both")
	if keepBothRR.Code != http.StatusOK {
		t.Fatalf("expected keep-both start status 200, got %d. Body: %s", keepBothRR.Code, keepBothRR.Body.String())
	}
	var meta uploadMeta
	if err := json.Unmarshal(keepBothRR.Body.Bytes(), &meta); err != nil {
		t.Fatal(err)
	}
	if meta.FileName != "movie (1).mkv" || meta.RelativePath != "movie (1).mkv" || meta.Conflict != "keep-both" {
		t.Fatalf("expected renamed keep-both metadata, got %+v", meta)
	}
}

func TestUploadStartRejectsWhenFreeSpaceTooLow(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "nodi-upload-session-diskfull-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	originalStatfs := statfsFunc
	statfsFunc = func(_ string, _ *syscall.Statfs_t) error {
		return nil
	}
	defer func() { statfsFunc = originalStatfs }()

	// Simulate 32 bytes free.
	statfsFunc = func(_ string, fs *syscall.Statfs_t) error {
		fs.Bavail = 32
		fs.Bsize = 1
		return nil
	}

	cfg := &config.Config{Root: tempDir, MaxChunkSize: 8}
	body, err := json.Marshal(map[string]any{
		"fileName":     "movie.mkv",
		"path":         "/",
		"relativePath": "movie.mkv",
		"conflict":     "keep-both",
		"size":         40,
		"chunkSize":    8,
		"totalChunks":  5,
	})
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/upload/start", bytes.NewReader(body))
	rr := httptest.NewRecorder()
	UploadStart(cfg).ServeHTTP(rr, req)
	if rr.Code != http.StatusInsufficientStorage {
		t.Fatalf("expected status 507, got %d body=%s", rr.Code, rr.Body.String())
	}
	if !bytes.Contains(rr.Body.Bytes(), []byte(diskFullMessage)) {
		t.Fatalf("expected disk-full message, got %s", rr.Body.String())
	}
}

func TestCleanupAbandonedUploads(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "nodi-upload-cleanup-test-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	oldID := "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	freshID := "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
	cfg := &config.Config{Root: tempDir, UploadTTL: time.Hour}
	if err := writeUploadMeta(tempDir, uploadMeta{
		UploadID:    oldID,
		FileName:    "old.bin",
		Path:        "/",
		Size:        10,
		ChunkSize:   5,
		TotalChunks: 2,
		CreatedAt:   time.Now().UTC().Add(-2 * time.Hour),
	}); err != nil {
		t.Fatal(err)
	}
	if err := writeUploadMeta(tempDir, uploadMeta{
		UploadID:    freshID,
		FileName:    "fresh.bin",
		Path:        "/",
		Size:        10,
		ChunkSize:   5,
		TotalChunks: 2,
		CreatedAt:   time.Now().UTC(),
	}); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(uploadDir(tempDir, oldID), "0.part"), []byte("old"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(uploadDir(tempDir, freshID), "0.part"), []byte("fresh"), 0600); err != nil {
		t.Fatal(err)
	}

	if err := CleanupAbandonedUploads(cfg); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(uploadDir(tempDir, oldID)); !os.IsNotExist(err) {
		t.Fatalf("expected old upload cleanup, got err=%v", err)
	}
	if _, err := os.Stat(uploadDir(tempDir, freshID)); err != nil {
		t.Fatalf("expected fresh upload to remain, got err=%v", err)
	}
}
