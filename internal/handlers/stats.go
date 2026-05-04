package handlers

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"syscall"
	"time"

	"github.com/Twarga/Nodi/internal/config"
	"github.com/Twarga/Nodi/internal/storage"
)

type storageStats struct {
	Used      int64 `json:"used"`
	Total     int64 `json:"total"`
	Free      int64 `json:"free"`
	FileCount int64 `json:"file_count"`
	DirCount  int64 `json:"dir_count"`
}

var (
	statsCache    storageStats
	statsCacheAt  time.Time
	statsCacheMu  sync.Mutex
	statsCacheTTL = 30 * time.Second
)

func computeStorage(root string) (storageStats, error) {
	var s storageStats

	err := filepath.WalkDir(root, func(_ string, d os.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if d.IsDir() {
			s.DirCount++
			return nil
		}
		info, err := d.Info()
		if err != nil {
			return nil
		}
		s.Used += info.Size()
		s.FileCount++
		return nil
	})
	if err != nil {
		return s, err
	}

	var fs syscall.Statfs_t
	if err := syscall.Statfs(root, &fs); err == nil {
		s.Total = int64(fs.Blocks) * int64(fs.Bsize)
		s.Free = int64(fs.Bavail) * int64(fs.Bsize)
	}
	return s, nil
}

func StorageStats(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		statsCacheMu.Lock()
		fresh := time.Since(statsCacheAt) < statsCacheTTL
		cached := statsCache
		statsCacheMu.Unlock()

		if fresh {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(cached)
			return
		}

		s, err := computeStorage(cfg.Root)
		if err != nil {
			http.Error(w, "failed to compute storage", http.StatusInternalServerError)
			return
		}

		statsCacheMu.Lock()
		statsCache = s
		statsCacheAt = time.Now()
		statsCacheMu.Unlock()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(s)
	}
}

func Activity(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		limit := 100
		if l := r.URL.Query().Get("limit"); l != "" {
			if parsed, err := fmt.Sscanf(l, "%d", &limit); err != nil || parsed != 1 || limit <= 0 {
				limit = 100
			}
			if limit > 500 {
				limit = 500
			}
		}

		logPath := filepath.Join(cfg.Root, ".nodilog.jsonl")
		f, err := os.Open(logPath)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode([]storage.ActivityEvent{})
			return
		}
		defer f.Close()

		var events []storage.ActivityEvent
		scanner := bufio.NewScanner(f)
		scanner.Buffer(make([]byte, 1024*1024), 1024*1024)
		for scanner.Scan() {
			var ev storage.ActivityEvent
			if err := json.Unmarshal(scanner.Bytes(), &ev); err != nil {
				continue
			}
			events = append(events, ev)
		}

		// Reverse: newest first
		for i, j := 0, len(events)-1; i < j; i, j = i+1, j-1 {
			events[i], events[j] = events[j], events[i]
		}

		if limit > len(events) {
			limit = len(events)
		}
		events = events[:limit]

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(events)
	}
}
