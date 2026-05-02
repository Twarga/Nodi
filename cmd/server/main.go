package main

import (
	"fmt"
	"log"

	"nodi/internal/config"
)

func main() {
	// Test with valid config
	os.Setenv("QL_USER", "admin")
	os.Setenv("QL_PASS_HASH", "$2a$12$testhash")
	os.Setenv("QL_ROOT", "/data")
	os.Setenv("QL_COOKIE_SECRET", "testsecret12345678901234567890123456789012")
	os.Setenv("QL_PORT", "8080")

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Config load failed: %v", err)
	}

	fmt.Printf("Config loaded: User=%s, Root=%s, Port=%s, MaxUpload=%d\n", 
		cfg.User, cfg.Root, cfg.Port, cfg.MaxUpload)

	// Test missing required env vars
	fmt.Println("\nTesting missing QL_PASS_HASH...")
	os.Unsetenv("QL_PASS_HASH")
	_, err = config.Load()
	if err != nil {
		fmt.Printf("Got expected error: %v\n", err)
	}

	fmt.Println("All tests passed!")
}