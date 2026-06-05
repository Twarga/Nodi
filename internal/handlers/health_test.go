package handlers_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/Twarga/Nodi/internal/config"
	"github.com/Twarga/Nodi/internal/handlers"
)

func TestHealthDetails(t *testing.T) {
	root, err := os.MkdirTemp("", "nodi-health-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(root)

	if err := os.WriteFile(filepath.Join(root, "file.txt"), []byte("hello"), 0644); err != nil {
		t.Fatal(err)
	}
	cfg := &config.Config{
		Root:           root,
		UploadTTL:      time.Hour,
		TrashRetention: 30 * 24 * time.Hour,
	}

	req := httptest.NewRequest(http.MethodGet, "/api/health/details", nil)
	rr := httptest.NewRecorder()
	handlers.HealthDetails(cfg, "test-version", func() time.Duration { return 2 * time.Minute }).ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected health status 200, got %d. Body: %s", rr.Code, rr.Body.String())
	}
	var res struct {
		Status           string `json:"status"`
		Version          string `json:"version"`
		Uptime           string `json:"uptime"`
		ActiveUploads    int    `json:"active_uploads"`
		AbandonedUploads int    `json:"abandoned_uploads"`
		TrashItems       int    `json:"trash_items"`
		Storage          struct {
			Used      int64 `json:"used"`
			FileCount int64 `json:"file_count"`
		} `json:"storage"`
	}
	if err := json.NewDecoder(rr.Body).Decode(&res); err != nil {
		t.Fatal(err)
	}
	if res.Status != "ok" || res.Version != "test-version" || res.Uptime != "2m0s" {
		t.Fatalf("unexpected status/version/uptime: %+v", res)
	}
	if res.Storage.Used < 5 || res.Storage.FileCount == 0 {
		t.Fatalf("expected storage details, got %+v", res.Storage)
	}
}
