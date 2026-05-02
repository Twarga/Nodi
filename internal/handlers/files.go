package handlers

import (
	"fmt"
	"path/filepath"
	"strings"
)

// SafePath resolves a subpath against a root directory and ensures no traversal.
func SafePath(root, subPath string) (string, error) {
	absRoot, err := filepath.Abs(root)
	if err != nil {
		return "", fmt.Errorf("invalid root path: %v", err)
	}

	// Join the absolute root with the subpath
	// filepath.Join will clean the resulting path
	fullPath := filepath.Join(absRoot, filepath.FromSlash(subPath))
	
	// Evaluate the absolute path of the result
	absFull, err := filepath.Abs(fullPath)
	if err != nil {
		return "", fmt.Errorf("invalid path: %v", err)
	}

	// Ensure the resulting absolute path is still within the absolute root
	if !strings.HasPrefix(absFull, absRoot) {
		return "", fmt.Errorf("path traversal attempt detected: %s", subPath)
	}

	return absFull, nil
}
