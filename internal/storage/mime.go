package storage

import (
	"path/filepath"
	"strings"
)

// GetMIME returns a basic MIME type based on file extension.
// It matches the requirements for Nodi's visual icon mapping.
func GetMIME(filename string) string {
	ext := strings.ToLower(filepath.Ext(filename))
	if ext != "" && ext[0] == '.' {
		ext = ext[1:]
	}

	switch ext {
	case "jpg", "jpeg", "png", "gif", "webp", "svg", "ico":
		return "image"
	case "mp4", "webm", "ogg", "mov", "avi":
		return "video"
	case "pdf":
		return "pdf"
	case "txt", "md", "csv", "json", "log":
		return "text"
	case "zip", "tar", "gz", "rar", "7z":
		return "archive"
	default:
		return "generic"
	}
}

// GetExt returns the extension without the dot.
func GetExt(filename string) string {
	ext := strings.ToLower(filepath.Ext(filename))
	if len(ext) > 0 && ext[0] == '.' {
		return ext[1:]
	}
	return ext
}
