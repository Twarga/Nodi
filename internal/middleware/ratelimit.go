package middleware

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

type RateLimiter struct {
	requests map[string]*clientLimit
	mu       sync.Mutex
	limit    int
	window   time.Duration
}

type clientLimit struct {
	count       int
	windowStart time.Time
}

func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	rl := &RateLimiter{
		requests: make(map[string]*clientLimit),
		limit:    limit,
		window:   window,
	}
	go rl.cleanup()
	return rl
}

func (rl *RateLimiter) cleanup() {
	ticker := time.NewTicker(rl.window)
	for range ticker.C {
		rl.mu.Lock()
		now := time.Now()
		for ip, cl := range rl.requests {
			if now.Sub(cl.windowStart) > rl.window {
				delete(rl.requests, ip)
			}
		}
		rl.mu.Unlock()
	}
}

func (rl *RateLimiter) Allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	cl, exists := rl.requests[ip]

	if !exists {
		rl.requests[ip] = &clientLimit{
			count:       1,
			windowStart: now,
		}
		return true
	}

	if now.Sub(cl.windowStart) > rl.window {
		cl.count = 1
		cl.windowStart = now
		return true
	}

	if cl.count >= rl.limit {
		return false
	}

	cl.count++
	return true
}

func RateLimit(rl *RateLimiter) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := clientIP(r.RemoteAddr)
			// When behind a trusted proxy, prefer X-Forwarded-For or X-Real-Ip
			if isTrustedProxy(ip) {
				if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
					ip = strings.TrimSpace(strings.Split(fwd, ",")[0])
				} else if real := r.Header.Get("X-Real-Ip"); real != "" {
					ip = real
				}
			}

			if !rl.Allow(ip) {
				http.Error(w, "Too many requests", http.StatusTooManyRequests)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func RateLimitMethods(rl *RateLimiter, methods ...string) func(http.Handler) http.Handler {
	allowedMethods := make(map[string]struct{}, len(methods))
	for _, method := range methods {
		allowedMethods[method] = struct{}{}
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if _, ok := allowedMethods[r.Method]; !ok {
				next.ServeHTTP(w, r)
				return
			}
			RateLimit(rl)(next).ServeHTTP(w, r)
		})
	}
}

func clientIP(remoteAddr string) string {
	if remoteAddr == "" {
		return "unknown"
	}
	host, _, err := net.SplitHostPort(remoteAddr)
	if err == nil && host != "" {
		return host
	}
	return remoteAddr
}

func isTrustedProxy(ip string) bool {
	// Common loopback and private addresses used by reverse proxies
	return ip == "127.0.0.1" || ip == "::1" || strings.HasPrefix(ip, "10.") || strings.HasPrefix(ip, "172.") || strings.HasPrefix(ip, "192.168.")
}
