package handlers

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"syscall"
)

const diskFullMessage = "Not enough disk space on Nodi storage."

var statfsFunc = syscall.Statfs

func existingPathForStatfs(path string) string {
	current := path
	for current != "" && current != "." && current != string(filepath.Separator) {
		if info, err := os.Stat(current); err == nil && info.IsDir() {
			return current
		}
		parent := filepath.Dir(current)
		if parent == current {
			break
		}
		current = parent
	}
	return string(filepath.Separator)
}

func freeBytesAtPath(path string) (int64, error) {
	var fs syscall.Statfs_t
	statPath := existingPathForStatfs(path)
	if err := statfsFunc(statPath, &fs); err != nil {
		return 0, err
	}
	return int64(fs.Bavail) * int64(fs.Bsize), nil
}

func isDiskFullErr(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, syscall.ENOSPC) {
		return true
	}
	return strings.Contains(strings.ToLower(err.Error()), "no space left on device")
}

func uploadHTTPErrorMessage(err error, fallback string) string {
	if isDiskFullErr(err) {
		return diskFullMessage
	}
	return fallback
}

func uploadItemErrorMessage(err error, fallback string) string {
	if isDiskFullErr(err) {
		return diskFullMessage
	}
	return fallback
}

func calculateFileSHA256(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()

	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

func humanSize(n int64) string {
	if n < 1024 {
		return fmt.Sprintf("%d B", n)
	}
	units := []string{"KB", "MB", "GB", "TB"}
	value := float64(n) / 1024
	unit := 0
	for value >= 1024 && unit < len(units)-1 {
		value /= 1024
		unit++
	}
	if value >= 10 {
		return fmt.Sprintf("%.0f %s", value, units[unit])
	}
	return fmt.Sprintf("%.1f %s", value, units[unit])
}
