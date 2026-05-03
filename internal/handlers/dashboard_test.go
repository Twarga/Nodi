package handlers_test

import (
	"context"
	"github.com/Twarga/Nodi/internal/auth"
	"github.com/Twarga/Nodi/internal/handlers"
	"github.com/Twarga/Nodi/internal/middleware"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"
)

func TestSPA_ServesIndexHtml(t *testing.T) {
	wd, err := os.Getwd()
	if err != nil {
		t.Fatalf("get cwd: %v", err)
	}
	if err := os.Chdir("../.."); err != nil {
		t.Fatalf("chdir repo root: %v", err)
	}
	defer os.Chdir(wd)

	// Ensure dist/index.html exists for the test
	if _, err := os.Stat("web/static/dist/index.html"); os.IsNotExist(err) {
		t.Skip("web/static/dist/index.html not found, run 'cd web/app && npm run build' first")
	}

	session := &auth.Session{User: "admin", Exp: time.Now().Add(time.Hour).Unix()}
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req = req.WithContext(contextWithSession(req, session))
	w := httptest.NewRecorder()

	handlers.SPA().ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", w.Code, w.Body.String())
	}
	body := w.Body.String()
	if !strings.Contains(body, "Nodi") || !strings.Contains(body, "<div id=\"app\">") {
		t.Fatalf("expected SPA shell, got: %s", body)
	}
}

func contextWithSession(r *http.Request, session *auth.Session) context.Context {
	return context.WithValue(r.Context(), middleware.SessionKey, session)
}
