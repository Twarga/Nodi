package handlers_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"nodi/internal/auth"
	"nodi/internal/config"
	"nodi/internal/handlers"
	"nodi/internal/middleware"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestDashboard_RendersAuthenticatedShell(t *testing.T) {
	wd, err := os.Getwd()
	if err != nil {
		t.Fatalf("get cwd: %v", err)
	}
	if err := os.Chdir("../.."); err != nil {
		t.Fatalf("chdir repo root: %v", err)
	}
	defer os.Chdir(wd)

	tmpRoot, err := os.MkdirTemp("", "nodi-dashboard-*")
	if err != nil {
		t.Fatalf("temp root: %v", err)
	}
	defer os.RemoveAll(tmpRoot)

	if err := os.WriteFile(filepath.Join(tmpRoot, "file.txt"), []byte("hello"), 0644); err != nil {
		t.Fatalf("write test file: %v", err)
	}

	session := &auth.Session{User: "admin", Exp: time.Now().Add(time.Hour).Unix()}
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req = req.WithContext(
		contextWithSession(req, session),
	)
	w := httptest.NewRecorder()

	handlers.Dashboard(&config.Config{Root: tmpRoot}).ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", w.Code, w.Body.String())
	}
	body := w.Body.String()
	if !strings.Contains(body, "Nodi") || !strings.Contains(body, "file.txt") {
		t.Fatalf("expected dashboard shell with file listing, got: %s", body)
	}
}

func contextWithSession(r *http.Request, session *auth.Session) context.Context {
	return context.WithValue(r.Context(), middleware.SessionKey, session)
}
