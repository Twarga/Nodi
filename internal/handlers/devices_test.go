package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Twarga/Nodi/internal/config"
)

func TestDevicesReturnsLocalAndWebDAVURLs(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/devices", nil)
	rr := httptest.NewRecorder()

	Devices(&config.Config{Port: "7319"}).ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rr.Code, rr.Body.String())
	}
	var res DevicesResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &res); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(res.Addresses) == 0 {
		t.Fatal("expected at least localhost address")
	}
	if res.Addresses[0].URL != "http://localhost:7319" {
		t.Fatalf("unexpected first URL %q", res.Addresses[0].URL)
	}
	if res.Addresses[0].WebDAV != "http://localhost:7319/dav/" {
		t.Fatalf("unexpected WebDAV URL %q", res.Addresses[0].WebDAV)
	}
	if res.Recommended == "" {
		t.Fatal("expected recommended URL")
	}
}

func TestDevicesRejectsWrongMethod(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/devices", nil)
	rr := httptest.NewRecorder()

	Devices(&config.Config{Port: "7319"}).ServeHTTP(rr, req)

	if rr.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}
