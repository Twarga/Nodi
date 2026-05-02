package main

import (
	"net/http"
	"net/http/httptest"
	"nodi/internal/config"
	"os"
	"testing"
)

func TestNewHandler_ServesStaticAssetsWithoutAuth(t *testing.T) {
	wd, err := os.Getwd()
	if err != nil {
		t.Fatalf("get cwd: %v", err)
	}
	if err := os.Chdir("../.."); err != nil {
		t.Fatalf("chdir repo root: %v", err)
	}
	defer os.Chdir(wd)

	req := httptest.NewRequest(http.MethodGet, "/static/app.js", nil)
	w := httptest.NewRecorder()

	NewHandler(&config.Config{CookieSecret: "test-secret"}).ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected static asset status 200, got %d: %s", w.Code, w.Body.String())
	}
	if contentType := w.Header().Get("Content-Type"); contentType == "text/plain; charset=utf-8" {
		t.Fatalf("expected javascript asset content type, got %q", contentType)
	}
}
