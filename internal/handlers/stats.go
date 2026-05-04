package handlers

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"syscall"
	"time"

	"github.com/Twarga/Nodi/internal/config"
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
