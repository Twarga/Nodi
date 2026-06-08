package storage

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

const (
	activityLogMaxSize = 10 * 1024 * 1024 // 10 MB
	activityLogMaxBack = 3
)

type ActivityEvent struct {
	At     time.Time `json:"at"`
	User   string    `json:"user"`
	Action string    `json:"action"`
	Path   string    `json:"path"`
	Extra  string    `json:"extra,omitempty"`
}

var activityMu sync.Mutex

func rotateActivityLog(logPath string) {
	info, err := os.Stat(logPath)
	if err != nil || info.Size() < activityLogMaxSize {
		return
	}
	// Shift backups: .2 -> .3, .1 -> .2, current -> .1
	for i := activityLogMaxBack - 1; i >= 1; i-- {
		oldPath := fmt.Sprintf("%s.%d", logPath, i)
		newPath := fmt.Sprintf("%s.%d", logPath, i+1)
		os.Rename(oldPath, newPath)
	}
	os.Rename(logPath, logPath+".1")
}

func Append(root string, ev ActivityEvent) {
	activityMu.Lock()
	defer activityMu.Unlock()
	if ev.At.IsZero() {
		ev.At = time.Now().UTC()
	}
	logPath := filepath.Join(root, ".nodilog.jsonl")
	rotateActivityLog(logPath)
	f, err := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
	if err != nil {
		return
	}
	defer f.Close()
	enc := json.NewEncoder(f)
	enc.Encode(ev)
}
