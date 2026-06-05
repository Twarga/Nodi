package main

import (
	"github.com/Twarga/Nodi/internal/config"
	"net/http"
	"net/http/httptest"
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

	req := httptest.NewRequest(http.MethodGet, "/static/dist/assets/index.js", nil)
	w := httptest.NewRecorder()

	NewHandler(&config.Config{CookieSecret: "test-secret"}).ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected static asset status 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestNewHandler_ServesPWAAssetsWithoutAuth(t *testing.T) {
	wd, err := os.Getwd()
	if err != nil {
		t.Fatalf("get cwd: %v", err)
	}
	if err := os.Chdir("../.."); err != nil {
		t.Fatalf("chdir repo root: %v", err)
	}
	defer os.Chdir(wd)

	tests := []struct {
		path        string
		contentType string
		headerName  string
		headerValue string
	}{
		{path: "/manifest.webmanifest", contentType: "application/manifest+json"},
		{path: "/sw.js", contentType: "application/javascript; charset=utf-8", headerName: "Service-Worker-Allowed", headerValue: "/"},
		{path: "/icons/icon-192.png", contentType: "image/png"},
	}

	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, tt.path, nil)
			w := httptest.NewRecorder()

			NewHandler(&config.Config{CookieSecret: "test-secret"}).ServeHTTP(w, req)

			if w.Code != http.StatusOK {
				t.Fatalf("expected status 200, got %d: %s", w.Code, w.Body.String())
			}
			if tt.contentType != "" {
				if got := w.Header().Get("Content-Type"); got != tt.contentType {
					t.Fatalf("expected Content-Type %q, got %q", tt.contentType, got)
				}
			}
			if tt.headerName != "" {
				if got := w.Header().Get(tt.headerName); got != tt.headerValue {
					t.Fatalf("expected %s %q, got %q", tt.headerName, tt.headerValue, got)
				}
			}
		})
	}
}

func TestNewHandler_SetsSecurityHeaders(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/login", nil)
	w := httptest.NewRecorder()

	NewHandler(&config.Config{CookieSecret: "test-secret"}).ServeHTTP(w, req)

	expectedHeaders := map[string]string{
		"X-Content-Type-Options": "nosniff",
		"X-Frame-Options":        "DENY",
		"Referrer-Policy":        "no-referrer",
	}
	for name, expected := range expectedHeaders {
		if got := w.Header().Get(name); got != expected {
			t.Fatalf("expected %s=%q, got %q", name, expected, got)
		}
	}
	if got := w.Header().Get("Content-Security-Policy"); got == "" {
		t.Fatal("expected Content-Security-Policy header")
	}
}

func TestHealthEndpoint(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	w := httptest.NewRecorder()

	NewHandler(&config.Config{CookieSecret: "test-secret"}).ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}
	if ct := w.Header().Get("Content-Type"); ct != "application/json" {
		t.Fatalf("expected Content-Type application/json, got %q", ct)
	}
	body := w.Body.String()
	if body == "" {
		t.Fatal("expected non-empty health response body")
	}
}

func TestVersionEndpoint(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/version", nil)
	w := httptest.NewRecorder()

	NewHandler(&config.Config{CookieSecret: "test-secret"}).ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}
	if ct := w.Header().Get("Content-Type"); ct != "application/json" {
		t.Fatalf("expected Content-Type application/json, got %q", ct)
	}
}
