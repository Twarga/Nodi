package main

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"nodi/internal/config"
	"nodi/internal/handlers"
	"nodi/internal/middleware"
)

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		
		rw := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}
		next.ServeHTTP(rw, r)
		
		duration := time.Since(start)
		log.Printf("%s %s %d %v", r.Method, r.URL.Path, rw.statusCode, duration)
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

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Config error: %v", err)
	}

	fmt.Printf("Nodi starting on port %s\n", cfg.Port)
	fmt.Printf("Serving files from: %s\n", cfg.Root)

	mux := http.NewServeMux()
	
	// Protected root endpoint — renders dashboard
	mux.Handle("/", middleware.AuthRequired(cfg.CookieSecret)(handlers.Dashboard(cfg)))

	// T12: Rate Limiter (5 requests per 15 minutes)
	loginRateLimiter := middleware.NewRateLimiter(5, 15*time.Minute)
	
	// T11 & T12: Login endpoint protected by rate limiter
	mux.Handle("/login", middleware.RateLimit(loginRateLimiter)(handlers.Login(cfg)))

	// T22: Browse endpoint
	mux.Handle("/browse", middleware.AuthRequired(cfg.CookieSecret)(handlers.Browse(cfg)))

	// T25: Create Folder API
	mux.Handle("/api/folder/create", middleware.AuthRequired(cfg.CookieSecret)(handlers.CreateFolder(cfg)))

	// Logout endpoint
	mux.Handle("/logout", http.HandlerFunc(handlers.Logout()))

	handler := loggingMiddleware(mux)

	log.Printf("Listening on :%s", cfg.Port)
	log.Fatal(http.ListenAndServe(":"+cfg.Port, handler))
}