package config

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// UpdateEnvFile rewrites .env so that the given key has the given value.
// If the key does not exist, it is appended. The write is atomic
// (write to .env.tmp then rename). Other lines are preserved verbatim.
//
// envPath is typically ".env". Caller must ensure permissions are correct
// after the rename (we copy the original mode if available).
func UpdateEnvFile(envPath, key, value string) error {
	abs, err := filepath.Abs(envPath)
	if err != nil {
		return err
	}

	// Read existing lines (if file exists).
	var lines []string
	mode := os.FileMode(0600)
	if info, err := os.Stat(abs); err == nil {
		mode = info.Mode().Perm()
		f, err := os.Open(abs)
		if err != nil {
			return err
		}
		scanner := bufio.NewScanner(f)
		// allow long lines (bcrypt hashes)
		scanner.Buffer(make([]byte, 1024*1024), 1024*1024)
		for scanner.Scan() {
			lines = append(lines, scanner.Text())
		}
		f.Close()
		if err := scanner.Err(); err != nil {
			return err
		}
	}

	prefix := key + "="
	replaced := false
	for i, line := range lines {
		trim := strings.TrimSpace(line)
		if strings.HasPrefix(trim, "#") {
			continue
		}
		if strings.HasPrefix(trim, prefix) {
			lines[i] = fmt.Sprintf("%s=%s", key, value)
			replaced = true
		}
	}
	if !replaced {
		lines = append(lines, fmt.Sprintf("%s=%s", key, value))
	}

	tmp := abs + ".tmp"
	out, err := os.OpenFile(tmp, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, mode)
	if err != nil {
		return err
	}
	w := bufio.NewWriter(out)
	for _, line := range lines {
		if _, err := w.WriteString(line + "\n"); err != nil {
			out.Close()
			os.Remove(tmp)
			return err
		}
	}
	if err := w.Flush(); err != nil {
		out.Close()
		os.Remove(tmp)
		return err
	}
	if err := out.Close(); err != nil {
		os.Remove(tmp)
		return err
	}
	return os.Rename(tmp, abs)
}
