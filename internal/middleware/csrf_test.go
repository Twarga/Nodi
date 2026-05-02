package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Twarga/Nodi/internal/middleware"
)

func TestCSRFProtect_SetsTokenOnSafeMethod(t *testing.T) {
	handler := middleware.CSRFProtect(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}

	cookie := w.Header().Get("Set-Cookie")
	if !strings.Contains(cookie, "ql_csrf=") {
		t.Fatal("expected ql_csrf cookie to be set")
	}

	token := w.Header().Get("X-CSRF-Token")
	if token == "" {
		t.Fatal("expected X-CSRF-Token header")
	}
}

func TestCSRFProtect_RejectsStateChangeWithoutToken(t *testing.T) {
	handler := middleware.CSRFProtect(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodPost, "/api/delete", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected status 403, got %d", w.Code)
	}
}

func TestCSRFProtect_RejectsMismatchedToken(t *testing.T) {
	handler := middleware.CSRFProtect(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodPost, "/api/delete", nil)
	req.AddCookie(&http.Cookie{Name: "ql_csrf", Value: "valid-token"})
	req.Header.Set("X-CSRF-Token", "wrong-token")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected status 403, got %d", w.Code)
	}
}

func TestCSRFProtect_AcceptsMatchingToken(t *testing.T) {
	handler := middleware.CSRFProtect(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodPost, "/api/delete", nil)
	req.AddCookie(&http.Cookie{Name: "ql_csrf", Value: "matching-token"})
	req.Header.Set("X-CSRF-Token", "matching-token")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}
}
