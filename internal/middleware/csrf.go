package middleware

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
)

// GenerateCSRFToken creates a random 32-byte token encoded as hex.
func GenerateCSRFToken() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic("failed to generate CSRF token: " + err.Error())
	}
	return hex.EncodeToString(b)
}

// SetCSRFCookie writes the CSRF token as a cookie.
// NOT HttpOnly so JavaScript can read it for the double-submit pattern.
func SetCSRFCookie(w http.ResponseWriter, token string) {
	http.SetCookie(w, &http.Cookie{
		Name:     "ql_csrf",
		Value:    token,
		Path:     "/",
		HttpOnly: false,
		SameSite: http.SameSiteStrictMode,
		MaxAge:   86400, // 24 hours
	})
}

// CSRFProtect returns middleware that validates the CSRF token on state-changing requests.
// Safe methods (GET, HEAD, OPTIONS, TRACE) are allowed without validation and receive a fresh token.
func CSRFProtect(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if isSafeMethod(r.Method) {
			// Set a fresh CSRF token on safe requests
			token := GenerateCSRFToken()
			SetCSRFCookie(w, token)
			// Also expose it in a header so templates can read it
			w.Header().Set("X-CSRF-Token", token)
			next.ServeHTTP(w, r)
			return
		}

		// State-changing request: validate token
		cookie, err := r.Cookie("ql_csrf")
		if err != nil {
			http.Error(w, "CSRF token missing", http.StatusForbidden)
			return
		}

		headerToken := r.Header.Get("X-CSRF-Token")
		if headerToken == "" {
			http.Error(w, "CSRF token missing in request", http.StatusForbidden)
			return
		}

		if cookie.Value != headerToken {
			http.Error(w, "CSRF token mismatch", http.StatusForbidden)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func isSafeMethod(method string) bool {
	switch method {
	case http.MethodGet, http.MethodHead, http.MethodOptions, http.MethodTrace:
		return true
	}
	return false
}
