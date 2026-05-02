package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"nodi/internal/auth"
	"nodi/internal/config"

	"golang.org/x/crypto/bcrypt"
)

func TestLogin_Success(t *testing.T) {
	passHash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
	cfg := &config.Config{
		User:          "admin",
		PassHash:      string(passHash),
		Root:          "/data",
		Port:          "8080",
		MaxUpload:     2147483648,
		CookieSecret: "test-secret-key",
		Theme:         "system",
		SessionExpiry: 24 * time.Hour,
	}

	body, _ := json.Marshal(LoginRequest{
		Username: "admin",
		Password: "password123",
	})

	req := httptest.NewRequest(http.MethodPost, "/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	Login(cfg).ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var resp LoginResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}

	if !resp.Success {
		t.Error("Expected success = true")
	}

	sessionCookie := w.Result().Cookies()
	if len(sessionCookie) == 0 {
		t.Error("Expected session cookie to be set")
	}
	if len(sessionCookie) > 0 && sessionCookie[0].Name != "ql_session" {
		t.Errorf("Expected cookie name 'ql_session', got %s", sessionCookie[0].Name)
	}
}

func TestLogin_InvalidPassword(t *testing.T) {
	passHash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
	cfg := &config.Config{
		User:          "admin",
		PassHash:      string(passHash),
		CookieSecret: "test-secret-key",
		SessionExpiry: 24 * time.Hour,
	}

	body, _ := json.Marshal(LoginRequest{
		Username: "admin",
		Password: "wrongpassword",
	})

	req := httptest.NewRequest(http.MethodPost, "/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	Login(cfg).ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401, got %d", w.Code)
	}

	var resp LoginResponse
	json.Unmarshal(w.Body.Bytes(), &resp)

	if resp.Success {
		t.Error("Expected success = false")
	}
}

func TestLogin_InvalidUsername(t *testing.T) {
	passHash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
	cfg := &config.Config{
		User:          "admin",
		PassHash:      string(passHash),
		CookieSecret: "test-secret-key",
		SessionExpiry: 24 * time.Hour,
	}

	body, _ := json.Marshal(LoginRequest{
		Username: "wronguser",
		Password: "password123",
	})

	req := httptest.NewRequest(http.MethodPost, "/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	Login(cfg).ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401, got %d", w.Code)
	}
}

func TestLogin_MissingFields(t *testing.T) {
	cfg := &config.Config{
		User:          "admin",
		PassHash:      "",
		CookieSecret: "test-secret-key",
		SessionExpiry: 24 * time.Hour,
	}

	body, _ := json.Marshal(LoginRequest{
		Username: "",
		Password: "",
	})

	req := httptest.NewRequest(http.MethodPost, "/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	Login(cfg).ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}
}

func TestLogin_WrongMethod(t *testing.T) {
	cfg := &config.Config{}

	req := httptest.NewRequest(http.MethodPut, "/login", nil)
	w := httptest.NewRecorder()

	Login(cfg).ServeHTTP(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("Expected status 405, got %d", w.Code)
	}
}

func TestAuthSessionCreation(t *testing.T) {
	token, err := auth.Create("admin", "test-secret", 24*time.Hour)
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	session, err := auth.Validate(token, "test-secret")
	if err != nil {
		t.Fatalf("Failed to validate session: %v", err)
	}

	if session.User != "admin" {
		t.Errorf("Expected user 'admin', got %s", session.User)
	}
}

func TestAuthSessionTampered(t *testing.T) {
	token, _ := auth.Create("admin", "test-secret", 24*time.Hour)

	_, err := auth.Validate(token, "wrong-secret")
	if err == nil {
		t.Error("Expected error for tampered session")
	}
}