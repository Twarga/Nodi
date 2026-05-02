package middleware

import (
	"context"
	"net/http"
	"nodi/internal/auth"
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
				// We can redirect to /login or return 401 Unauthorized for API routes.
				// For the scope of a file manager frontend, returning 401 JSON/HTML is standard.
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			// Embed session in context if downstream handlers need it.
			ctx := context.WithValue(r.Context(), SessionKey, session)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
