package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"nodi/internal/auth"
	"nodi/internal/middleware"
	"testing"
	"time"
)

func TestAuthMiddleware_NoCookieRedirectsBrowserToLogin(t *testing.T) {
	handler := middleware.AuthRequired("supersecret")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusSeeOther {
		t.Errorf("Expected 303 redirect, got %d", w.Code)
	}
	if location := w.Header().Get("Location"); location != "/login" {
		t.Errorf("Expected redirect to /login, got %q", location)
	}
}

func TestAuthMiddleware_NoCookieReturnsUnauthorizedForAPI(t *testing.T) {
	handler := middleware.AuthRequired("supersecret")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/files", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401 Unauthorized, got %d", w.Code)
	}
}

func TestAuthMiddleware_ValidCookie(t *testing.T) {
	secret := "supersecret"
	token, _ := auth.Create("admin", secret, 1*time.Hour)

	handler := middleware.AuthRequired(secret)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		session := r.Context().Value(middleware.SessionKey).(*auth.Session)
		if session == nil || session.User != "admin" {
			t.Errorf("Failed to retrieve correctly populated session from context")
		}
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/protected", nil)
	req.AddCookie(&http.Cookie{Name: "ql_session", Value: token})
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected 200 OK, got %d", w.Code)
	}
}

func TestAuthMiddleware_InvalidCookie(t *testing.T) {
	secret := "supersecret"
	token, _ := auth.Create("admin", "wrongsecret", 1*time.Hour)

	handler := middleware.AuthRequired(secret)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/protected", nil)
	req.AddCookie(&http.Cookie{Name: "ql_session", Value: token})
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401 Unauthorized due to bad signature, got %d", w.Code)
	}
}
