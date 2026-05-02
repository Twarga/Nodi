package middleware

import (
	"context"
	"net/http"
	"nodi/internal/auth"
	"strings"
)

// SessionContextKey is the key used for storing the session inside the request context.
type SessionContextKey string

const SessionKey SessionContextKey = "session"

// AuthRequired returns a middleware that strictly validates the session token.
func AuthRequired(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			session, err := auth.GetSessionFromRequest(r, secret)
			if err != nil {
				if shouldRedirectToLogin(r) {
					http.Redirect(w, r, "/login", http.StatusSeeOther)
					return
				}
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			// Embed session in context if downstream handlers need it.
			ctx := context.WithValue(r.Context(), SessionKey, session)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func shouldRedirectToLogin(r *http.Request) bool {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		return false
	}
	if strings.HasPrefix(r.URL.Path, "/api/") || r.URL.Path == "/browse" {
		return false
	}
	return true
}
