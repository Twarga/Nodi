package handlers

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Twarga/Nodi/internal/config"
	"golang.org/x/crypto/bcrypt"
)

func TestCreateShareStoresTokenHashOnly(t *testing.T) {
	root, err := os.MkdirTemp("", "nodi-share-token-hash-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(root)

	if err := os.WriteFile(filepath.Join(root, "file.txt"), []byte("hello"), 0644); err != nil {
		t.Fatal(err)
	}
	cfg := &config.Config{Root: root, CookieSecret: "test-secret-with-more-than-32-bytes"}

	body := strings.NewReader(`{"path":"file.txt","mode":"read"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/share", body)
	rr := httptest.NewRecorder()
	CreateShare(cfg).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected create share 200, got %d body=%s", rr.Code, rr.Body.String())
	}
	var created struct {
		Token string `json:"token"`
		URL   string `json:"url"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	if len(created.Token) < 40 || created.URL != "/s/"+created.Token {
		t.Fatalf("expected strong returned token and URL, got token=%q url=%q", created.Token, created.URL)
	}

	data, err := os.ReadFile(filepath.Join(root, ".nodishare.json"))
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(data, []byte(created.Token)) {
		t.Fatalf("raw share token was stored in metadata: %s", string(data))
	}
	if !bytes.Contains(data, []byte(`"token_hash"`)) {
		t.Fatalf("expected token_hash in share metadata: %s", string(data))
	}

	serveReq := httptest.NewRequest(http.MethodGet, "/"+created.Token, nil)
	serveRR := httptest.NewRecorder()
	ServeShare(cfg).ServeHTTP(serveRR, serveReq)
	if serveRR.Code != http.StatusOK {
		t.Fatalf("expected hashed-token share to serve, got %d body=%s", serveRR.Code, serveRR.Body.String())
	}

	revokeReq := httptest.NewRequest(http.MethodDelete, "/api/share?token="+url.QueryEscape(created.Token), nil)
	revokeRR := httptest.NewRecorder()
	RevokeShare(cfg).ServeHTTP(revokeRR, revokeReq)
	if revokeRR.Code != http.StatusOK {
		t.Fatalf("expected revoke by raw token to work, got %d body=%s", revokeRR.Code, revokeRR.Body.String())
	}
}

func TestServeShareEscapesDirectoryListing(t *testing.T) {
	root, err := os.MkdirTemp("", "nodi-share-xss-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(root)

	shared := filepath.Join(root, "shared")
	if err := os.MkdirAll(shared, 0755); err != nil {
		t.Fatal(err)
	}
	xssName := `<img src=x onerror=alert(1)>.txt`
	if err := os.WriteFile(filepath.Join(shared, xssName), []byte("x"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := saveShares(root, shareFile{Shares: []shareEntry{{
		Token:     "tok",
		Path:      "shared",
		IsDir:     true,
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
		Mode:      "read",
	}}}); err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodGet, "/tok", nil)
	rr := httptest.NewRecorder()
	ServeShare(&config.Config{Root: root, CookieSecret: "test-secret-with-more-than-32-bytes"}).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", rr.Code, rr.Body.String())
	}
	body := rr.Body.String()
	if strings.Contains(body, xssName) {
		t.Fatalf("expected unsafe filename to be escaped, got %s", body)
	}
	if !strings.Contains(body, `&lt;img src=x onerror=alert(1)&gt;.txt`) {
		t.Fatalf("expected escaped filename in listing, got %s", body)
	}
}

func TestServeSharePasswordUnlockUsesPostCookie(t *testing.T) {
	root, err := os.MkdirTemp("", "nodi-share-password-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(root)

	shared := filepath.Join(root, "shared")
	if err := os.MkdirAll(shared, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(shared, "file.txt"), []byte("x"), 0644); err != nil {
		t.Fatal(err)
	}
	hash, err := bcrypt.GenerateFromPassword([]byte("secret"), bcrypt.DefaultCost)
	if err != nil {
		t.Fatal(err)
	}
	if err := saveShares(root, shareFile{Shares: []shareEntry{{
		Token:        "tok",
		Path:         "shared",
		IsDir:        true,
		CreatedAt:    time.Now().UTC().Format(time.RFC3339),
		PasswordHash: string(hash),
		Mode:         "read",
	}}}); err != nil {
		t.Fatal(err)
	}
	cfg := &config.Config{Root: root, CookieSecret: "test-secret-with-more-than-32-bytes"}

	queryReq := httptest.NewRequest(http.MethodGet, "/tok?password=secret", nil)
	queryRR := httptest.NewRecorder()
	ServeShare(cfg).ServeHTTP(queryRR, queryReq)
	if queryRR.Code != http.StatusUnauthorized {
		t.Fatalf("expected query password to be ignored, got %d", queryRR.Code)
	}
	if strings.Contains(strings.ToLower(queryRR.Body.String()), `method="get"`) {
		t.Fatalf("password form must not use GET: %s", queryRR.Body.String())
	}
	if !strings.Contains(strings.ToLower(queryRR.Body.String()), `method="post"`) {
		t.Fatalf("password form should use POST: %s", queryRR.Body.String())
	}

	form := url.Values{"password": {"secret"}}
	unlockReq := httptest.NewRequest(http.MethodPost, "/tok/unlock", strings.NewReader(form.Encode()))
	unlockReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	unlockRR := httptest.NewRecorder()
	ServeShare(cfg).ServeHTTP(unlockRR, unlockReq)
	if unlockRR.Code != http.StatusSeeOther {
		t.Fatalf("expected unlock redirect, got %d body=%s", unlockRR.Code, unlockRR.Body.String())
	}
	cookies := unlockRR.Result().Cookies()
	if len(cookies) == 0 {
		t.Fatal("expected unlock cookie")
	}

	listReq := httptest.NewRequest(http.MethodGet, "/tok", nil)
	listReq.AddCookie(cookies[0])
	listRR := httptest.NewRecorder()
	ServeShare(cfg).ServeHTTP(listRR, listReq)
	if listRR.Code != http.StatusOK {
		t.Fatalf("expected authenticated listing, got %d body=%s", listRR.Code, listRR.Body.String())
	}
	if !strings.Contains(listRR.Body.String(), "file.txt") {
		t.Fatalf("expected share listing after unlock, got %s", listRR.Body.String())
	}
}

func TestServeShareUploadDropbox(t *testing.T) {
	root, err := os.MkdirTemp("", "nodi-share-dropbox-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(root)

	shared := filepath.Join(root, "incoming")
	if err := os.MkdirAll(shared, 0755); err != nil {
		t.Fatal(err)
	}
	if err := saveShares(root, shareFile{Shares: []shareEntry{{
		Token:     "drop",
		Path:      "incoming",
		IsDir:     true,
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
		Mode:      "upload",
	}}}); err != nil {
		t.Fatal(err)
	}
	cfg := &config.Config{Root: root, CookieSecret: "test-secret-with-more-than-32-bytes"}

	pageReq := httptest.NewRequest(http.MethodGet, "/drop", nil)
	pageRR := httptest.NewRecorder()
	ServeShare(cfg).ServeHTTP(pageRR, pageReq)
	if pageRR.Code != http.StatusOK {
		t.Fatalf("expected dropbox page status 200, got %d", pageRR.Code)
	}
	if !strings.Contains(pageRR.Body.String(), `type="file"`) {
		t.Fatalf("expected upload form, got %s", pageRR.Body.String())
	}

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("files", "hello.txt")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := part.Write([]byte("hello")); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	uploadReq := httptest.NewRequest(http.MethodPost, "/drop/upload", body)
	uploadReq.Header.Set("Content-Type", writer.FormDataContentType())
	uploadRR := httptest.NewRecorder()
	ServeShare(cfg).ServeHTTP(uploadRR, uploadReq)
	if uploadRR.Code != http.StatusOK {
		t.Fatalf("expected upload status 200, got %d body=%s", uploadRR.Code, uploadRR.Body.String())
	}
	if data, err := os.ReadFile(filepath.Join(shared, "hello.txt")); err != nil || string(data) != "hello" {
		t.Fatalf("expected uploaded file, data=%q err=%v", string(data), err)
	}
}

func TestServeShareReadOnlyRejectsUpload(t *testing.T) {
	root, err := os.MkdirTemp("", "nodi-share-readonly-upload-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(root)

	shared := filepath.Join(root, "shared")
	if err := os.MkdirAll(shared, 0755); err != nil {
		t.Fatal(err)
	}
	if err := saveShares(root, shareFile{Shares: []shareEntry{{
		Token:     "read",
		Path:      "shared",
		IsDir:     true,
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
		Mode:      "read",
	}}}); err != nil {
		t.Fatal(err)
	}
	cfg := &config.Config{Root: root, CookieSecret: "test-secret-with-more-than-32-bytes"}

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("files", "hello.txt")
	if err != nil {
		t.Fatal(err)
	}
	_, _ = part.Write([]byte("hello"))
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, "/read/upload", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	rr := httptest.NewRecorder()
	ServeShare(cfg).ServeHTTP(rr, req)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d body=%s", rr.Code, rr.Body.String())
	}
}

func TestServeShareUploadDropboxMaxFileSize(t *testing.T) {
	root, err := os.MkdirTemp("", "nodi-share-dropbox-max-size-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(root)

	shared := filepath.Join(root, "incoming")
	if err := os.MkdirAll(shared, 0755); err != nil {
		t.Fatal(err)
	}
	if err := saveShares(root, shareFile{Shares: []shareEntry{{
		Token:       "drop",
		Path:        "incoming",
		IsDir:       true,
		CreatedAt:   time.Now().UTC().Format(time.RFC3339),
		Mode:        "upload",
		MaxFileSize: 4,
	}}}); err != nil {
		t.Fatal(err)
	}
	cfg := &config.Config{Root: root, CookieSecret: "test-secret-with-more-than-32-bytes"}

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("files", "hello.txt")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := part.Write([]byte("hello")); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodPost, "/drop/upload", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	rr := httptest.NewRecorder()
	ServeShare(cfg).ServeHTTP(rr, req)
	if rr.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("expected 413, got %d body=%s", rr.Code, rr.Body.String())
	}
}

func TestServeShareUploadDropboxMaxFileCount(t *testing.T) {
	root, err := os.MkdirTemp("", "nodi-share-dropbox-max-count-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(root)

	shared := filepath.Join(root, "incoming")
	if err := os.MkdirAll(shared, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(shared, "existing.txt"), []byte("already here"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := saveShares(root, shareFile{Shares: []shareEntry{{
		Token:        "drop",
		Path:         "incoming",
		IsDir:        true,
		CreatedAt:    time.Now().UTC().Format(time.RFC3339),
		Mode:         "upload",
		MaxFileCount: 1,
	}}}); err != nil {
		t.Fatal(err)
	}
	cfg := &config.Config{Root: root, CookieSecret: "test-secret-with-more-than-32-bytes"}

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("files", "hello.txt")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := part.Write([]byte("hello")); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodPost, "/drop/upload", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	rr := httptest.NewRecorder()
	ServeShare(cfg).ServeHTTP(rr, req)
	if rr.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d body=%s", rr.Code, rr.Body.String())
	}
}
