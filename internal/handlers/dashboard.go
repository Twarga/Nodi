package handlers

import (
	"net/http"
	"os"
	"time"

	"github.com/Twarga/Nodi/internal/auth"
	"github.com/Twarga/Nodi/internal/config"
	"github.com/Twarga/Nodi/internal/middleware"
)

type DashboardData struct {
	Username string
	Initial  string
	Path     []BreadcrumbSegment
	Files    []FileInfo
}

func Dashboard(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		session, ok := r.Context().Value(middleware.SessionKey).(*auth.Session)
		if !ok || session == nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		subPath := r.URL.Query().Get("path")
		fullPath, err := SafePath(cfg.Root, subPath)
		if err != nil {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}

		files, err := ListFiles(fullPath)
		if err != nil {
			if os.IsNotExist(err) {
				http.Error(w, "Not Found", http.StatusNotFound)
				return
			}
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}

		initial := ""
		if len(session.User) > 0 {
			initial = string(session.User[0])
		}

		data := DashboardData{
			Username: session.User,
			Initial:  initial,
			Path:     BuildBreadcrumbs(subPath),
			Files:    files,
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		RenderTemplate(
			w,
			data,
			"web/templates/layout.html",
			"web/templates/dashboard.html",
			"web/templates/components/breadcrumbs.html",
			"web/templates/components/file-row.html",
			"web/templates/components/file-card.html",
			"web/templates/components/modal.html",
		)
	}
}

func Logout() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		http.SetCookie(w, &http.Cookie{
			Name:     "ql_session",
			Value:    "",
			Path:     "/",
			HttpOnly: true,
			Secure:   isSecureRequest(r),
			SameSite: http.SameSiteStrictMode,
			Expires:  time.Unix(0, 0),
			MaxAge:   -1,
		})
		http.Redirect(w, r, "/login", http.StatusSeeOther)
	}
}
