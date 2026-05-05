package middleware

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/Twarga/Nodi/internal/auth"
)

// SessionContextKey is the key used for storing the session inside the request context.
type SessionContextKey string

const SessionKey SessionContextKey = "session"

// AuthRequired returns a middleware that validates the session token and
// refreshes the cookie expiry on every request (sliding expiration).
func AuthRequired(secret string, expiry time.Duration) func(http.Handler) http.Handler {
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

			// Refresh session cookie on every valid request (sliding expiration)
			if expiry > 0 {
				newToken, err := auth.Create(session.User, secret, expiry)
				if err == nil {
					cookie := http.Cookie{
						Name:     "ql_session",
						Value:    newToken,
						Path:     "/",
						HttpOnly: true,
						Secure:   r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https",
						SameSite: http.SameSiteStrictMode,
						MaxAge:   int(expiry.Seconds()),
					}
					http.SetCookie(w, &cookie)
				}
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
