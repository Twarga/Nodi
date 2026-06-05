package handlers

import (
	"encoding/json"
	"net/http"
	"os"

	"github.com/Twarga/Nodi/internal/auth"
	"github.com/Twarga/Nodi/internal/config"
	"github.com/Twarga/Nodi/internal/storage"
	"golang.org/x/crypto/bcrypt"
)

type passwordChangeRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

// ChangePassword verifies the current password, hashes the new one,
// rewrites .env, updates the in-memory cfg.PassHash, and revokes every
// outstanding session so old cookies stop working immediately.
func ChangePassword(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req passwordChangeRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		if len(req.NewPassword) < 8 {
			http.Error(w, "new password must be at least 8 characters", http.StatusBadRequest)
			return
		}

		if err := bcrypt.CompareHashAndPassword([]byte(cfg.PassHash), []byte(req.CurrentPassword)); err != nil {
			http.Error(w, "current password is incorrect", http.StatusUnauthorized)
			return
		}

		newHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
		if err != nil {
			http.Error(w, "failed to hash password", http.StatusInternalServerError)
			return
		}

		envPath := os.Getenv("QL_ENV_FILE")
		if envPath == "" {
			envPath = ".env"
		}
		if err := config.UpdateEnvFile(envPath, "QL_PASS_HASH", string(newHash)); err != nil {
			http.Error(w, "failed to persist password: "+err.Error(), http.StatusInternalServerError)
			return
		}

		cfg.PassHash = string(newHash)
		auth.RevokeAllSessions()
		storage.Append(cfg.Root, storage.ActivityEvent{User: sessionUserFromCtx(r.Context()), Action: "password_change", Path: ""})

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]bool{"success": true})
	}
}
