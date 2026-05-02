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