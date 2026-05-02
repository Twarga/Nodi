package handlers

import (
	"html/template"
	"log"
	"net/http"
	"time"

	"nodi/internal/auth"
	"nodi/internal/config"
	"nodi/internal/middleware"
)

type DashboardData struct {
	Username string
	Initial  string
}

func Dashboard(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		session, ok := r.Context().Value(middleware.SessionKey).(*auth.Session)
		if !ok || session == nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		tmpl, err := template.ParseFiles("web/templates/layout.html", "web/templates/dashboard.html")
		if err != nil {
			log.Printf("Dashboard template parsing error: %v", err)
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}

		initial := ""
		if len(session.User) > 0 {
			initial = string(session.User[0])
		}
		data := DashboardData{Username: session.User, Initial: initial}
		if err := tmpl.ExecuteTemplate(w, "layout.html", data); err != nil {
			log.Printf("Dashboard template execution error: %v", err)
		}
	}
}

func Logout() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		http.SetCookie(w, &http.Cookie{
			Name:     "ql_session",
			Value:    "",
			Path:     "/",
			HttpOnly: true,
			SameSite: http.SameSiteStrictMode,
			Expires:  time.Unix(0, 0),
			MaxAge:   -1,
		})
		http.Redirect(w, r, "/login", http.StatusSeeOther)
	}
}
