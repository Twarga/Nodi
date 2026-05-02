package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestRateLimiter_AllowsRequestsWithinLimit(t *testing.T) {
	rl := NewRateLimiter(5, time.Minute)

	for i := 0; i < 5; i++ {
		if !rl.Allow("127.0.0.1") {
			t.Errorf("Expected request %d to be allowed", i+1)
		}
	}
}

func TestRateLimiter_BlocksRequestsOverLimit(t *testing.T) {
	rl := NewRateLimiter(5, time.Minute)

	for i := 0; i < 5; i++ {
		rl.Allow("127.0.0.1")
	}

	if rl.Allow("127.0.0.1") {
		t.Error("Expected request to be blocked")
	}
}

func TestRateLimiter_SeparateIPs(t *testing.T) {
	rl := NewRateLimiter(5, time.Minute)

	for i := 0; i < 5; i++ {
		rl.Allow("127.0.0.1")
	}

	if !rl.Allow("127.0.0.2") {
		t.Error("Expected different IP to be allowed")
	}
}

func TestRateLimiter_ResetsAfterWindow(t *testing.T) {
	rl := NewRateLimiter(3, 50*time.Millisecond)

	for i := 0; i < 3; i++ {
		rl.Allow("127.0.0.1")
	}

	if rl.Allow("127.0.0.1") {
		t.Error("Expected request to be blocked")
	}

	time.Sleep(60 * time.Millisecond)

	if !rl.Allow("127.0.0.1") {
		t.Error("Expected request to be allowed after window reset")
	}
}

func TestRateLimitMiddleware(t *testing.T) {
	rl := NewRateLimiter(3, time.Minute)

	handler := RateLimit(rl)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	for i := 0; i < 3; i++ {
		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		req.RemoteAddr = "127.0.0.1:1234"
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status 200, got %d", w.Code)
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.RemoteAddr = "127.0.0.1:1234"
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusTooManyRequests {
		t.Errorf("Expected status 429, got %d", w.Code)
	}
}

func TestRateLimitMiddleware_NormalizesRemotePort(t *testing.T) {
	rl := NewRateLimiter(2, time.Minute)

	handler := RateLimit(rl)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	for _, addr := range []string{"127.0.0.1:1000", "127.0.0.1:2000"} {
		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		req.RemoteAddr = addr
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("Expected status 200 for %s, got %d", addr, w.Code)
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.RemoteAddr = "127.0.0.1:3000"
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusTooManyRequests {
		t.Errorf("Expected status 429 after same host changed ports, got %d", w.Code)
	}
}

func TestRateLimitMethods_OnlyLimitsConfiguredMethods(t *testing.T) {
	rl := NewRateLimiter(1, time.Minute)

	handler := RateLimitMethods(rl, http.MethodPost)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	for i := 0; i < 3; i++ {
		req := httptest.NewRequest(http.MethodGet, "/login", nil)
		req.RemoteAddr = "127.0.0.1:1234"
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("Expected GET status 200, got %d", w.Code)
		}
	}

	for i, expected := range []int{http.StatusOK, http.StatusTooManyRequests} {
		req := httptest.NewRequest(http.MethodPost, "/login", nil)
		req.RemoteAddr = "127.0.0.1:1234"
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		if w.Code != expected {
			t.Fatalf("POST %d expected status %d, got %d", i+1, expected, w.Code)
		}
	}
}
