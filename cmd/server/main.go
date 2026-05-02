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
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "Nodi is running! Root: %s", cfg.Root)
	})

	// T12: Rate Limiter (5 requests per 15 minutes)
	loginRateLimiter := middleware.NewRateLimiter(5, 15*time.Minute)
	
	// T11 & T12: Login endpoint protected by rate limiter
	mux.Handle("/login", middleware.RateLimit(loginRateLimiter)(handlers.Login(cfg)))

	handler := loggingMiddleware(mux)

	log.Printf("Listening on :%s", cfg.Port)
	log.Fatal(http.ListenAndServe(":"+cfg.Port, handler))
}