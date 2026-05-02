package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"nodi/internal/auth"
	"nodi/internal/config"

	"golang.org/x/crypto/bcrypt"
)

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message,omitempty"`
}

func Login(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req LoginRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(LoginResponse{Success: false, Message: "Invalid request body"})
			return
		}

		if req.Username == "" || req.Password == "" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(LoginResponse{Success: false, Message: "Username and password required"})
			return
		}

		if req.Username != cfg.User {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(LoginResponse{Success: false, Message: "Invalid credentials"})
			return
		}

		if err := bcrypt.CompareHashAndPassword([]byte(cfg.PassHash), []byte(req.Password)); err != nil {
			log.Printf("Failed login attempt for user %s: %v", req.Username, err)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(LoginResponse{Success: false, Message: "Invalid credentials"})
			return
		}

		sessionToken, err := auth.Create(req.Username, cfg.CookieSecret, cfg.SessionExpiry)
		if err != nil {
			log.Printf("Failed to create session: %v", err)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(LoginResponse{Success: false, Message: "Failed to create session"})
			return
		}

		cookie := http.Cookie{
			Name:     "ql_session",
			Value:    sessionToken,
			Path:     "/",
			HttpOnly: true,
			SameSite: http.SameSiteStrictMode,
			Expires:  time.Now().Add(cfg.SessionExpiry),
		}
		http.SetCookie(w, &cookie)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(LoginResponse{Success: true})
	}
}