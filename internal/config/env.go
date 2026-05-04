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
	Host          string
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
		Root:          getEnv("QL_ROOT", "./nodi_files"),
		Host:          getEnv("QL_HOST", "0.0.0.0"),
		Port:          getEnv("QL_PORT", "7319"),
		MaxUpload:     int64(2147483648),
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
	if len(cfg.CookieSecret) < 32 {
		return nil, fmt.Errorf("QL_COOKIE_SECRET must be at least 32 bytes (got %d)", len(cfg.CookieSecret))
	}

	// Validate QL_ROOT exists and is a directory
	if info, err := os.Stat(cfg.Root); err != nil {
		return nil, fmt.Errorf("QL_ROOT does not exist: %w", err)
	} else if !info.IsDir() {
		return nil, fmt.Errorf("QL_ROOT is not a directory: %s", cfg.Root)
	}

	// Validate QL_PORT is numeric and in valid range
	portNum, err := strconv.Atoi(cfg.Port)
	if err != nil {
		return nil, fmt.Errorf("QL_PORT must be a number: %w", err)
	}
	if portNum < 1 || portNum > 65535 {
		return nil, fmt.Errorf("QL_PORT must be between 1 and 65535 (got %d)", portNum)
	}

	// Parse optional QL_SESSION_EXPIRY
	if expiryStr := os.Getenv("QL_SESSION_EXPIRY"); expiryStr != "" {
		d, err := time.ParseDuration(expiryStr)
		if err != nil {
			return nil, fmt.Errorf("invalid QL_SESSION_EXPIRY: %w", err)
		}
		cfg.SessionExpiry = d
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
