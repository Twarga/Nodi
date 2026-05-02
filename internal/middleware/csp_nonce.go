package middleware

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"net/http"
)

type contextKey string

const NonceKey contextKey = "nonce"

func generateNonce() string {
	b := make([]byte, 16)
	rand.Read(b)
	return base64.StdEncoding.EncodeToString(b)
}

// CSPNonce returns a middleware that generates a per-request nonce and adds it
// to the Content-Security-Policy header, replacing unsafe-inline.
func CSPNonce(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nonce := generateNonce()
		ctx := context.WithValue(r.Context(), NonceKey, nonce)

		w.Header().Set("Content-Security-Policy",
			"default-src 'self'; "+
				"script-src 'self' 'nonce-"+nonce+"'; "+
				"style-src 'self' 'nonce-"+nonce+"'; "+
				"img-src 'self' data:; "+
				"object-src 'none'; "+
				"base-uri 'self'; "+
				"frame-ancestors 'none'")

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// GetNonce extracts the CSP nonce from the request context.
func GetNonce(r *http.Request) string {
	if nonce, ok := r.Context().Value(NonceKey).(string); ok {
		return nonce
	}
	return ""
}
