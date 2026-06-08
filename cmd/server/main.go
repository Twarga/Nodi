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

	// Limit non-upload request bodies to 1 MB to prevent memory exhaustion.
	bodyLimit := middleware.LimitBodySize(1 << 20)

	staticFiles := http.FileServer(http.Dir("web/static"))
	mux.Handle("/static/", cacheStaticHeaders(http.StripPrefix("/static/", staticFiles)))
	mux.Handle("/icons/", cacheStaticHeaders(http.StripPrefix("/icons/", http.FileServer(http.Dir("web/static/dist/icons")))))
	mux.HandleFunc("/favicon.svg", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "web/static/dist/favicon.svg")
	})
	mux.HandleFunc("/manifest.webmanifest", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/manifest+json")
		http.ServeFile(w, r, "web/static/dist/manifest.webmanifest")
	})
	mux.HandleFunc("/sw.js", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
		w.Header().Set("Service-Worker-Allowed", "/")
		w.Header().Set("Cache-Control", "no-cache")
		http.ServeFile(w, r, "web/static/dist/sw.js")
	})

	// Health and version endpoints (no auth required)
	mux.HandleFunc("/api/health", healthHandler)
	mux.HandleFunc("/api/version", versionHandler)

	// Metrics endpoint requires auth to prevent info leakage
	mux.Handle("/api/metrics", middleware.AuthRequired(cfg.CookieSecret, cfg.SessionExpiry)(bodyLimit(http.HandlerFunc(metricsHandler))))
	mux.Handle("/api/health/details", middleware.AuthRequired(cfg.CookieSecret, cfg.SessionExpiry)(bodyLimit(handlers.HealthDetails(cfg, version, func() time.Duration {
		return time.Since(startTime)
	}))))

	// WebDAV for native desktop/mobile file managers. Uses Basic Auth.
	mux.Handle("/dav/", handlers.WebDAV(cfg))

	// Device connection helpers
	mux.Handle("/api/devices", middleware.AuthRequired(cfg.CookieSecret, cfg.SessionExpiry)(bodyLimit(handlers.Devices(cfg))))

	// SPA auth check
	mux.Handle("/api/whoami", middleware.AuthRequired(cfg.CookieSecret, cfg.SessionExpiry)(bodyLimit(handlers.Whoami())))

	// Protected root endpoint — serves Preact SPA
	mux.Handle("/", middleware.AuthRequired(cfg.CookieSecret, cfg.SessionExpiry)(handlers.SPA()))

	// T12: Rate Limiter (5 requests per 15 minutes)
	loginRateLimiter := middleware.NewRateLimiter(5, 15*time.Minute)

	// T11 & T12: Only POST login attempts are rate-limited; page refreshes stay usable.
	mux.Handle("/login", middleware.RateLimitMethods(loginRateLimiter, http.MethodPost)(bodyLimit(handlers.Login(cfg))))

	// T22: Browse endpoint
	mux.Handle("/browse", middleware.AuthRequired(cfg.CookieSecret, cfg.SessionExpiry)(bodyLimit(handlers.Browse(cfg))))
	mux.Handle("/api/search", middleware.AuthRequired(cfg.CookieSecret, cfg.SessionExpiry)(bodyLimit(handlers.Search(cfg))))

	// T25: Create Folder API
	mux.Handle("/api/folder/create", middleware.AuthRequired(cfg.CookieSecret, cfg.SessionExpiry)(bodyLimit(handlers.CreateFolder(cfg))))
	mux.Handle("/api/file/create", middleware.AuthRequired(cfg.CookieSecret, cfg.SessionExpiry)(bodyLimit(handlers.CreateFile(cfg))))

	// T26: Delete API
	mux.Handle("/api/delete", middleware.AuthRequired(cfg.CookieSecret, cfg.SessionExpiry)(bodyLimit(handlers.Delete(cfg))))
	mux.Handle("/api/restore", middleware.AuthRequired(cfg.CookieSecret, cfg.SessionExpiry)(bodyLimit(handlers.Restore(cfg))))
	mux.Handle("/api/trash", middleware.AuthRequired(cfg.CookieSecret, cfg.SessionExpiry)(bodyLimit(handlers.Trash(cfg))))
	mux.Handle("/api/recent", middleware.AuthRequired(cfg.CookieSecret, cfg.SessionExpiry)(bodyLimit(handlers.Recent(cfg))))
	mux.Handle("/api/favorite", middleware.AuthRequired(cfg.CookieSecret, cfg.SessionExpiry)(bodyLimit(handlers.Favorite(cfg))))

	// T27: Rename API
	mux.Handle("/api/rename", middleware.AuthRequired(cfg.CookieSecret, cfg.SessionExpiry)(bodyLimit(handlers.Rename(cfg))))
	mux.Handle("/api/storage", middleware.AuthRequired(cfg.CookieSecret, cfg.SessionExpiry)(bodyLimit(handlers.StorageStats(cfg))))
	mux.Handle("/api/password", middleware.AuthRequired(cfg.CookieSecret, cfg.SessionExpiry)(bodyLimit(handlers.ChangePassword(cfg))))

	// Share API
	mux.Handle("/api/share", middleware.AuthRequired(cfg.CookieSecret, cfg.SessionExpiry)(bodyLimit(handlers.SharesRouter(cfg))))
	mux.Handle("/s/", http.StripPrefix("/s/", handlers.ServeShare(cfg)))

	// Activity log
	mux.Handle("/api/activity", middleware.AuthRequired(cfg.CookieSecret, cfg.SessionExpiry)(bodyLimit(handlers.Activity(cfg))))
	mux.Handle("/api/cleanup", middleware.AuthRequired(cfg.CookieSecret, cfg.SessionExpiry)(bodyLimit(handlers.Cleanup(cfg))))

	// Backup / Restore
	mux.Handle("/api/backup", middleware.AuthRequired(cfg.CookieSecret, cfg.SessionExpiry)(handlers.Backup(cfg)))
	mux.Handle("/api/restore-backup", middleware.AuthRequired(cfg.CookieSecret, cfg.SessionExpiry)(bodyLimit(handlers.RestoreBackup(cfg))))

	// T33: Upload API — no bodyLimit here; upload handlers set their own limits.
	mux.Handle("/api/upload", middleware.AuthRequired(cfg.CookieSecret, cfg.SessionExpiry)(handlers.Upload(cfg)))
	mux.Handle("/api/upload/start", middleware.AuthRequired(cfg.CookieSecret, cfg.SessionExpiry)(bodyLimit(handlers.UploadStart(cfg))))
	mux.Handle("/api/upload/status", middleware.AuthRequired(cfg.CookieSecret, cfg.SessionExpiry)(bodyLimit(handlers.UploadStatus(cfg))))
	mux.Handle("/api/upload/chunk", middleware.AuthRequired(cfg.CookieSecret, cfg.SessionExpiry)(handlers.ChunkUpload(cfg)))
	mux.Handle("/api/upload/complete", middleware.AuthRequired(cfg.CookieSecret, cfg.SessionExpiry)(bodyLimit(handlers.ChunkComplete(cfg))))
	mux.Handle("/api/upload/", middleware.AuthRequired(cfg.CookieSecret, cfg.SessionExpiry)(bodyLimit(handlers.UploadSessionRouter(cfg))))

	// Download API — no bodyLimit; these stream large files.
	mux.Handle("/api/download", middleware.AuthRequired(cfg.CookieSecret, cfg.SessionExpiry)(handlers.Download(cfg)))
	mux.Handle("/api/edit", middleware.AuthRequired(cfg.CookieSecret, cfg.SessionExpiry)(bodyLimit(handlers.Edit(cfg))))
	mux.Handle("/api/hash", middleware.AuthRequired(cfg.CookieSecret, cfg.SessionExpiry)(bodyLimit(handlers.Hash(cfg))))
	mux.Handle("/api/thumb", middleware.AuthRequired(cfg.CookieSecret, cfg.SessionExpiry)(handlers.Thumb(cfg)))
	mux.Handle("/api/stream", middleware.AuthRequired(cfg.CookieSecret, cfg.SessionExpiry)(handlers.Stream(cfg)))

	// Move and Copy API
	mux.Handle("/api/move", middleware.AuthRequired(cfg.CookieSecret, cfg.SessionExpiry)(bodyLimit(handlers.Move(cfg))))
	mux.Handle("/api/copy", middleware.AuthRequired(cfg.CookieSecret, cfg.SessionExpiry)(bodyLimit(handlers.Copy(cfg))))
	mux.Handle("/api/duplicate", middleware.AuthRequired(cfg.CookieSecret, cfg.SessionExpiry)(bodyLimit(handlers.Duplicate(cfg))))
	mux.Handle("/api/compress", middleware.AuthRequired(cfg.CookieSecret, cfg.SessionExpiry)(bodyLimit(handlers.Compress(cfg))))
	mux.Handle("/api/extract", middleware.AuthRequired(cfg.CookieSecret, cfg.SessionExpiry)(bodyLimit(handlers.Extract(cfg))))

	// Logout endpoint
	mux.Handle("/logout", bodyLimit(http.HandlerFunc(handlers.Logout())))

	return loggingMiddleware(securityHeaders(middleware.CSPNonce(middleware.CSRFProtect(mux))))
}

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Config error: %v", err)
	}

	if err := handlers.InitTemplates(); err != nil {
		log.Fatalf("Template init error: %v", err)
	}
	if err := handlers.CleanupAbandonedUploads(cfg); err != nil {
		log.Printf("Upload cleanup warning: %v", err)
	}
	if removed, err := handlers.CleanupExpiredTrash(cfg); err != nil {
		log.Printf("Trash cleanup warning: %v", err)
	} else if removed > 0 {
		log.Printf("Trash cleanup removed %d expired item(s)", removed)
	}

	fmt.Printf("Nodi starting on %s:%s\n", cfg.Host, cfg.Port)
	fmt.Printf("Serving files from: %s\n", cfg.Root)

	bindAddr := cfg.Host + ":" + cfg.Port

	srv := &http.Server{
		Addr:              bindAddr,
		Handler:           NewHandler(cfg),
		ReadHeaderTimeout: 30 * time.Second,
		IdleTimeout:       5 * time.Minute,
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
		if ips := handlers.LocalIPs(); len(ips) > 0 {
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
