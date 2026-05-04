package storage

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type ActivityEvent struct {
	At     time.Time `json:"at"`
	User   string    `json:"user"`
	Action string    `json:"action"`
	Path   string    `json:"path"`
	Extra  string    `json:"extra,omitempty"`
}

var activityMu sync.Mutex

func Append(root string, ev ActivityEvent) {
	activityMu.Lock()
	defer activityMu.Unlock()
	if ev.At.IsZero() {
		ev.At = time.Now().UTC()
	}
	logPath := filepath.Join(root, ".nodilog.jsonl")
	f, err := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
	if err != nil {
		return
	}
	defer f.Close()
	enc := json.NewEncoder(f)
	enc.Encode(ev)
}
