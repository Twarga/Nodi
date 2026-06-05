package config

import (
	"strings"
	"testing"

	"golang.org/x/crypto/bcrypt"
)

func setRequiredEnv(t *testing.T, root string) {
	t.Helper()
	t.Setenv("QL_ROOT", root)
	t.Setenv("QL_PASS_HASH", "$2b$10$giD/vH5ZWt26q8GEN0PdZejq/ZdpxdMci5bK4U2fnLHj1mfqZXmCy")
	t.Setenv("QL_PORT", "7319")
}

func TestLoadRejectsUnsafeCookieSecretDefaults(t *testing.T) {
	root := t.TempDir()
	setRequiredEnv(t, root)
	t.Setenv("QL_COOKIE_SECRET", "local-development-secret-keep-it-safe-123")

	_, err := Load()
	if err == nil {
		t.Fatal("expected unsafe cookie secret to be rejected")
	}
	if !strings.Contains(err.Error(), "unsafe default") {
		t.Fatalf("expected unsafe default error, got %v", err)
	}
}

func TestLoadAcceptsRandomCookieSecret(t *testing.T) {
	root := t.TempDir()
	setRequiredEnv(t, root)
	t.Setenv("QL_COOKIE_SECRET", "m1lkFvX10I2a6xEqV4EUtLZ4A7vS9xYtTbjmdOMkzxc=")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("expected random cookie secret to load, got %v", err)
	}
	if cfg.Root != root {
		t.Fatalf("expected root %q, got %q", root, cfg.Root)
	}
}

func TestLoadHashesBootstrapPasswordWhenPassHashMissing(t *testing.T) {
	root := t.TempDir()
	setRequiredEnv(t, root)
	t.Setenv("QL_PASS_HASH", "")
	t.Setenv("QL_BOOTSTRAP_PASSWORD", "generated-password-123")
	t.Setenv("QL_COOKIE_SECRET", "m1lkFvX10I2a6xEqV4EUtLZ4A7vS9xYtTbjmdOMkzxc=")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("expected bootstrap password to load, got %v", err)
	}
	if cfg.PassHash == "" || cfg.PassHash == "generated-password-123" {
		t.Fatalf("expected hashed bootstrap password, got %q", cfg.PassHash)
	}
	if err := bcrypt.CompareHashAndPassword([]byte(cfg.PassHash), []byte("generated-password-123")); err != nil {
		t.Fatalf("expected generated password to match hash: %v", err)
	}
}

func TestLoadRejectsShortBootstrapPassword(t *testing.T) {
	root := t.TempDir()
	setRequiredEnv(t, root)
	t.Setenv("QL_PASS_HASH", "")
	t.Setenv("QL_BOOTSTRAP_PASSWORD", "short")
	t.Setenv("QL_COOKIE_SECRET", "m1lkFvX10I2a6xEqV4EUtLZ4A7vS9xYtTbjmdOMkzxc=")

	_, err := Load()
	if err == nil {
		t.Fatal("expected short bootstrap password to be rejected")
	}
	if !strings.Contains(err.Error(), "QL_BOOTSTRAP_PASSWORD") {
		t.Fatalf("expected bootstrap password error, got %v", err)
	}
}
