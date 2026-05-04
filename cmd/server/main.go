package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"sync/atomic"
	"syscall"
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

func cacheStaticHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "public, max-age=86400, immutable")
		next.ServeHTTP(w, r)
	})
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
	mux.Handle("/static/", cacheStaticHeaders(http.StripPrefix("/static/", staticFiles)))

	// Health and version endpoints (no auth required)
	mux.HandleFunc("/api/health", healthHandler)
	mux.HandleFunc("/api/version", versionHandler)

	// Metrics endpoint requires auth to prevent info leakage
	mux.Handle("/api/metrics", middleware.AuthRequired(cfg.CookieSecret)(http.HandlerFunc(metricsHandler)))

	// SPA auth check
	mux.Handle("/api/whoami", middleware.AuthRequired(cfg.CookieSecret)(handlers.Whoami()))

	// Protected root endpoint — serves Preact SPA
	mux.Handle("/", middleware.AuthRequired(cfg.CookieSecret)(handlers.SPA()))

	// T12: Rate Limiter (5 requests per 15 minutes)
	loginRateLimiter := middleware.NewRateLimiter(5, 15*time.Minute)

	// T11 & T12: Only POST login attempts are rate-limited; page refreshes stay usable.
	mux.Handle("/login", middleware.RateLimitMethods(loginRateLimiter, http.MethodPost)(handlers.Login(cfg)))

	// T22: Browse endpoint
	mux.Handle("/browse", middleware.AuthRequired(cfg.CookieSecret)(handlers.Browse(cfg)))

	// T25: Create Folder API
	mux.Handle("/api/folder/create", middleware.AuthRequired(cfg.CookieSecret)(handlers.CreateFolder(cfg)))
	mux.Handle("/api/file/create", middleware.AuthRequired(cfg.CookieSecret)(handlers.CreateFile(cfg)))

	// T26: Delete API
	mux.Handle("/api/delete", middleware.AuthRequired(cfg.CookieSecret)(handlers.Delete(cfg)))
	mux.Handle("/api/restore", middleware.AuthRequired(cfg.CookieSecret)(handlers.Restore(cfg)))
	mux.Handle("/api/recent", middleware.AuthRequired(cfg.CookieSecret)(handlers.Recent(cfg)))
	mux.Handle("/api/favorite", middleware.AuthRequired(cfg.CookieSecret)(handlers.Favorite(cfg)))

	// T27: Rename API
	mux.Handle("/api/rename", middleware.AuthRequired(cfg.CookieSecret)(handlers.Rename(cfg)))
	mux.Handle("/api/storage", middleware.AuthRequired(cfg.CookieSecret)(handlers.StorageStats(cfg)))
	mux.Handle("/api/password", middleware.AuthRequired(cfg.CookieSecret)(handlers.ChangePassword(cfg)))

	// Share API
	mux.Handle("/api/share", middleware.AuthRequired(cfg.CookieSecret)(handlers.SharesRouter(cfg)))
	mux.Handle("/s/", http.StripPrefix("/s/", handlers.ServeShare(cfg)))

	// Activity log
	mux.Handle("/api/activity", middleware.AuthRequired(cfg.CookieSecret)(handlers.Activity(cfg)))

	// Backup / Restore
	mux.Handle("/api/backup", middleware.AuthRequired(cfg.CookieSecret)(handlers.Backup(cfg)))
	mux.Handle("/api/restore-backup", middleware.AuthRequired(cfg.CookieSecret)(handlers.RestoreBackup(cfg)))

	// T33: Upload API
	mux.Handle("/api/upload", middleware.AuthRequired(cfg.CookieSecret)(handlers.Upload(cfg)))
	mux.Handle("/api/upload/chunk", middleware.AuthRequired(cfg.CookieSecret)(handlers.ChunkUpload(cfg)))
	mux.Handle("/api/upload/complete", middleware.AuthRequired(cfg.CookieSecret)(handlers.ChunkComplete(cfg)))

	// Download API
	mux.Handle("/api/download", middleware.AuthRequired(cfg.CookieSecret)(handlers.Download(cfg)))
	mux.Handle("/api/edit", middleware.AuthRequired(cfg.CookieSecret)(handlers.Edit(cfg)))
	mux.Handle("/api/thumb", middleware.AuthRequired(cfg.CookieSecret)(handlers.Thumb(cfg)))
	mux.Handle("/api/stream", middleware.AuthRequired(cfg.CookieSecret)(handlers.Stream(cfg)))

	// Move and Copy API
	mux.Handle("/api/move", middleware.AuthRequired(cfg.CookieSecret)(handlers.Move(cfg)))
	mux.Handle("/api/copy", middleware.AuthRequired(cfg.CookieSecret)(handlers.Copy(cfg)))
	mux.Handle("/api/duplicate", middleware.AuthRequired(cfg.CookieSecret)(handlers.Duplicate(cfg)))
	mux.Handle("/api/compress", middleware.AuthRequired(cfg.CookieSecret)(handlers.Compress(cfg)))
	mux.Handle("/api/extract", middleware.AuthRequired(cfg.CookieSecret)(handlers.Extract(cfg)))

	// Logout endpoint
	mux.Handle("/logout", http.HandlerFunc(handlers.Logout()))

	return loggingMiddleware(securityHeaders(middleware.CSPNonce(middleware.CSRFProtect(mux))))
}

func localIPs() []string {
	ifaces, err := net.Interfaces()
	if err != nil {
		return nil
	}
	var ips []string
	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			var ip net.IP
			switch v := addr.(type) {
			case *net.IPNet:
				ip = v.IP
			case *net.IPAddr:
				ip = v.IP
			}
			if ip == nil || ip.IsLoopback() || ip.IsLinkLocalUnicast() {
				continue
			}
			if ipv4 := ip.To4(); ipv4 != nil {
				ips = append(ips, ipv4.String())
			}
		}
	}
	return ips
}

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Config error: %v", err)
	}

	if err := handlers.InitTemplates(); err != nil {
		log.Fatalf("Template init error: %v", err)
	}

	fmt.Printf("Nodi starting on %s:%s\n", cfg.Host, cfg.Port)
	fmt.Printf("Serving files from: %s\n", cfg.Root)

	bindAddr := cfg.Host + ":" + cfg.Port

	srv := &http.Server{
		Addr:         bindAddr,
		Handler:      NewHandler(cfg),
		ReadTimeout:  30 * time.Minute,
		WriteTimeout: 60 * time.Minute,
		IdleTimeout:  120 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go func() {
		listener, err := net.Listen("tcp", bindAddr)
		if err != nil {
			log.Fatalf("Listen error: %v", err)
		}
		defer listener.Close()

		fmt.Println("")
		fmt.Printf("  Local:   http://localhost:%s\n", cfg.Port)
		if ips := localIPs(); len(ips) > 0 {
			for _, ip := range ips {
				fmt.Printf("  Network: http://%s:%s\n", ip, cfg.Port)
			}
		}
		fmt.Println("")

		log.Printf("Listening on %s", bindAddr)
		if err := srv.Serve(listener); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	<-ctx.Done()
	log.Println("Shutdown signal received, draining connections...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("Graceful shutdown failed: %v", err)
	}
	log.Println("Server stopped gracefully")
}
