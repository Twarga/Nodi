package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
)

type Config struct {
	User           string
	PassHash       string
	Root           string
	Host           string
	Port           string
	MaxUpload      int64
	MaxChunkSize   int64
	CookieSecret   string
	Theme          string
	SessionExpiry  time.Duration
	UploadTTL      time.Duration
	TrashRetention time.Duration
}

func Load() (*Config, error) {
	cfg := &Config{
		User:           getEnv("QL_USER", "admin"),
		PassHash:       getEnv("QL_PASS_HASH", ""),
		Root:           getEnv("QL_ROOT", "./nodi_files"),
		Host:           getEnv("QL_HOST", "0.0.0.0"),
		Port:           getEnv("QL_PORT", "7319"),
		MaxUpload:      int64(1099511627776), // 1 TB default
		MaxChunkSize:   int64(16 * 1024 * 1024),
		CookieSecret:   getEnv("QL_COOKIE_SECRET", ""),
		Theme:          getEnv("QL_THEME", "system"),
		SessionExpiry:  24 * time.Hour,
		UploadTTL:      48 * time.Hour,
		TrashRetention: 30 * 24 * time.Hour,
	}

	if cfg.PassHash == "" {
		bootstrapPassword := os.Getenv("QL_BOOTSTRAP_PASSWORD")
		if bootstrapPassword == "" {
			return nil, fmt.Errorf("QL_PASS_HASH or QL_BOOTSTRAP_PASSWORD is required")
		}
		if len(bootstrapPassword) < 12 {
			return nil, fmt.Errorf("QL_BOOTSTRAP_PASSWORD must be at least 12 characters")
		}
		hash, err := bcrypt.GenerateFromPassword([]byte(bootstrapPassword), bcrypt.DefaultCost)
		if err != nil {
			return nil, fmt.Errorf("failed to hash QL_BOOTSTRAP_PASSWORD: %w", err)
		}
		cfg.PassHash = string(hash)
	}
	if cfg.CookieSecret == "" {
		return nil, fmt.Errorf("QL_COOKIE_SECRET is required")
	}
	if len(cfg.CookieSecret) < 32 {
		return nil, fmt.Errorf("QL_COOKIE_SECRET must be at least 32 bytes (got %d)", len(cfg.CookieSecret))
	}
	if unsafeCookieSecret(cfg.CookieSecret) {
		return nil, fmt.Errorf("QL_COOKIE_SECRET is an unsafe default or placeholder; generate a random value with: openssl rand -base64 48")
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
	if maxChunkStr := os.Getenv("QL_MAX_CHUNK_SIZE"); maxChunkStr != "" {
		maxChunkSize, err := strconv.ParseInt(maxChunkStr, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("invalid QL_MAX_CHUNK_SIZE: %w", err)
		}
		if maxChunkSize <= 0 {
			return nil, fmt.Errorf("QL_MAX_CHUNK_SIZE must be positive")
		}
		cfg.MaxChunkSize = maxChunkSize
	}
	if uploadTTLStr := os.Getenv("QL_UPLOAD_TTL"); uploadTTLStr != "" {
		d, err := time.ParseDuration(uploadTTLStr)
		if err != nil {
			return nil, fmt.Errorf("invalid QL_UPLOAD_TTL: %w", err)
		}
		if d <= 0 {
			return nil, fmt.Errorf("QL_UPLOAD_TTL must be positive")
		}
		cfg.UploadTTL = d
	}
	if trashRetentionStr := os.Getenv("QL_TRASH_RETENTION"); trashRetentionStr != "" {
		d, err := time.ParseDuration(trashRetentionStr)
		if err != nil {
			return nil, fmt.Errorf("invalid QL_TRASH_RETENTION: %w", err)
		}
		if d <= 0 {
			return nil, fmt.Errorf("QL_TRASH_RETENTION must be positive")
		}
		cfg.TrashRetention = d
	}

	return cfg, nil
}

func unsafeCookieSecret(secret string) bool {
	normalized := strings.ToLower(strings.TrimSpace(secret))
	if normalized == "" {
		return true
	}
	knownUnsafe := map[string]bool{
		"local-development-secret-keep-it-safe-123":             true,
		"change-this-to-a-random-string-at-least-32-bytes-long": true,
		"change-me": true,
		"changeme":  true,
		"secret":    true,
		"password":  true,
	}
	if knownUnsafe[normalized] {
		return true
	}
	if strings.Contains(normalized, "change-this") || strings.Contains(normalized, "changeme") || strings.Contains(normalized, "example") || strings.Contains(normalized, "placeholder") {
		return true
	}
	return false
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
