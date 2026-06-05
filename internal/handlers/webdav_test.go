package handlers

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Twarga/Nodi/internal/config"
	"golang.org/x/crypto/bcrypt"
)

func testDAVConfig(t *testing.T, root string) *config.Config {
	t.Helper()

	hash, err := bcrypt.GenerateFromPassword([]byte("secret"), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}
	return &config.Config{
		User:         "admin",
		PassHash:     string(hash),
		Root:         root,
		CookieSecret: "test-secret-with-more-than-32-bytes",
	}
}

func authenticatedDAVRequest(method, url, body string) *http.Request {
	req := httptest.NewRequest(method, url, strings.NewReader(body))
	req.SetBasicAuth("admin", "secret")
	return req
}

func TestWebDAVRequiresBasicAuth(t *testing.T) {
	root := t.TempDir()

	req := httptest.NewRequest("PROPFIND", "/dav/", nil)
	rr := httptest.NewRecorder()
	WebDAV(testDAVConfig(t, root)).ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rr.Code)
	}
	if !strings.Contains(rr.Header().Get("WWW-Authenticate"), "Nodi WebDAV") {
		t.Fatalf("expected WebDAV basic auth challenge, got %q", rr.Header().Get("WWW-Authenticate"))
	}
}

func TestWebDAVPutAndGetWithAppCredentials(t *testing.T) {
	root := t.TempDir()
	handler := WebDAV(testDAVConfig(t, root))

	putReq := authenticatedDAVRequest(http.MethodPut, "/dav/hello.txt", "hello from dav")
	putRR := httptest.NewRecorder()
	handler.ServeHTTP(putRR, putReq)
	if putRR.Code != http.StatusCreated && putRR.Code != http.StatusNoContent {
		t.Fatalf("expected PUT success, got %d body=%s", putRR.Code, putRR.Body.String())
	}

	content, err := os.ReadFile(filepath.Join(root, "hello.txt"))
	if err != nil {
		t.Fatalf("expected uploaded file: %v", err)
	}
	if string(content) != "hello from dav" {
		t.Fatalf("unexpected file content %q", string(content))
	}

	getReq := authenticatedDAVRequest(http.MethodGet, "/dav/hello.txt", "")
	getRR := httptest.NewRecorder()
	handler.ServeHTTP(getRR, getReq)
	if getRR.Code != http.StatusOK {
		t.Fatalf("expected GET 200, got %d body=%s", getRR.Code, getRR.Body.String())
	}
	if getRR.Body.String() != "hello from dav" {
		t.Fatalf("unexpected GET body %q", getRR.Body.String())
	}
}

func TestWebDAVBlocksInternalNodiFiles(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, ".nodishare.json"), []byte(`{"shares":[]}`), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(filepath.Join(root, ".cache"), 0700); err != nil {
		t.Fatal(err)
	}

	handler := WebDAV(testDAVConfig(t, root))

	for _, target := range []string{"/dav/.nodishare.json", "/dav/.cache"} {
		req := authenticatedDAVRequest(http.MethodGet, target, "")
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)
		if rr.Code == http.StatusOK {
			t.Fatalf("expected %s to be inaccessible, got %d body=%s", target, rr.Code, rr.Body.String())
		}
		if strings.Contains(rr.Body.String(), "shares") {
			t.Fatalf("expected %s response not to leak internal content, got %q", target, rr.Body.String())
		}
	}
}
