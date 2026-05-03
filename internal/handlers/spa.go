package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/Twarga/Nodi/internal/auth"
	"github.com/Twarga/Nodi/internal/middleware"
)

func Whoami() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		session, ok := r.Context().Value(middleware.SessionKey).(*auth.Session)
		if !ok || session == nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]string{"error": "unauthorized"})
			return
		}

		initial := ""
		if len(session.User) > 0 {
			initial = string(session.User[0])
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"name":     session.User,
			"initials": initial,
		})
	}
}

func SPA() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "web/static/dist/index.html")
	}
}
