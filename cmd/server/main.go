package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync/atomic"
	"time"

	"github.com/Twarga/Nodi/internal/config"
	"github.com/Twarga/Nodi/internal/handlers"
	"github.com/Twarga/Nodi/internal/middleware"
)

type contextKey string

const requestIDKey contextKey = "request-id"

func generateRequestID() string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return "unknown"
	}
	return hex.EncodeToString(b)
}

var (
	version      = "dev"
	startTime    = time.Now()
	requestCount int64
)

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		reqID := generateRequestID()
		w.Header().Set("X-Request-ID", reqID)
		atomic.AddInt64(&requestCount, 1)

		rw := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}
		next.ServeHTTP(rw, r)

		duration := time.Since(start)
		log.Printf("[%s] %s %s %d %v", reqID, r.Method, r.URL.Path, rw.statusCode, duration)
	})
}

func metricsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"requests_total": atomic.LoadInt64(&requestCount),
		"uptime":         time.Since(startTime).Round(time.Second).String(),
		"version":        version,
	})
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'")
		next.ServeHTTP(w, r)
	})
}

type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "ok",
		"version": version,
		"uptime":  time.Since(startTime).Round(time.Second).String(),
	})
}

func versionHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"version":    version,
		"go_version": "1.24",
	})
}

func NewHandler(cfg *config.Config) http.Handler {
	mux := http.NewServeMux()

	staticFiles := http.FileServer(http.Dir("web/static"))
	mux.Handle("/static/", http.StripPrefix("/static/", staticFiles))

	// Health, version, and metrics endpoints (no auth required)
	mux.HandleFunc("/api/health", healthHandler)
	mux.HandleFunc("/api/version", versionHandler)
	mux.HandleFunc("/api/metrics", metricsHandler)

	// Protected root endpoint — renders dashboard
	mux.Handle("/", middleware.AuthRequired(cfg.CookieSecret)(handlers.Dashboard(cfg)))

	// T12: Rate Limiter (5 requests per 15 minutes)
	loginRateLimiter := middleware.NewRateLimiter(5, 15*time.Minute)

	// T11 & T12: Only POST login attempts are rate-limited; page refreshes stay usable.
	mux.Handle("/login", middleware.RateLimitMethods(loginRateLimiter, http.MethodPost)(handlers.Login(cfg)))

	// T22: Browse endpoint
	mux.Handle("/browse", middleware.AuthRequired(cfg.CookieSecret)(handlers.Browse(cfg)))

	// T25: Create Folder API
	mux.Handle("/api/folder/create", middleware.AuthRequired(cfg.CookieSecret)(handlers.CreateFolder(cfg)))

	// T26: Delete API
	mux.Handle("/api/delete", middleware.AuthRequired(cfg.CookieSecret)(handlers.Delete(cfg)))

	// T27: Rename API
	mux.Handle("/api/rename", middleware.AuthRequired(cfg.CookieSecret)(handlers.Rename(cfg)))

	// T33: Upload API
	mux.Handle("/api/upload", middleware.AuthRequired(cfg.CookieSecret)(handlers.Upload(cfg)))

	// Download API
	mux.Handle("/api/download", middleware.AuthRequired(cfg.CookieSecret)(handlers.Download(cfg)))

	// Logout endpoint
	mux.Handle("/logout", http.HandlerFunc(handlers.Logout()))

	return loggingMiddleware(securityHeaders(mux))
}

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Config error: %v", err)
	}

	fmt.Printf("Nodi starting on port %s\n", cfg.Port)
	fmt.Printf("Serving files from: %s\n", cfg.Root)

	log.Printf("Listening on :%s", cfg.Port)
	log.Fatal(http.ListenAndServe(":"+cfg.Port, NewHandler(cfg)))
}
