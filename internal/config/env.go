package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

type Config struct {
	User          string
	PassHash      string
	Root          string
	Port          string
	MaxUpload     int64
	CookieSecret  string
	Theme         string
	SessionExpiry time.Duration
}

func Load() (*Config, error) {
	cfg := &Config{
		User:          getEnv("QL_USER", "admin"),
		PassHash:      getEnv("QL_PASS_HASH", ""),
		Root:          getEnv("QL_ROOT", "/data"),
		Port:          getEnv("QL_PORT", "7319"),
		MaxUpload:     int64(2147483648), // 2GB default
		CookieSecret:  getEnv("QL_COOKIE_SECRET", ""),
		Theme:         getEnv("QL_THEME", "system"),
		SessionExpiry: 24 * time.Hour,
	}

	if cfg.PassHash == "" {
		return nil, fmt.Errorf("QL_PASS_HASH is required")
	}
	if cfg.CookieSecret == "" {
		return nil, fmt.Errorf("QL_COOKIE_SECRET is required")
	}

	if maxUploadStr := os.Getenv("QL_MAX_UPLOAD"); maxUploadStr != "" {
		maxUpload, err := strconv.ParseInt(maxUploadStr, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("invalid QL_MAX_UPLOAD: %w", err)
		}
		cfg.MaxUpload = maxUpload
	}

	return cfg, nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
