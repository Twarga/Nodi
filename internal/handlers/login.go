package handlers

import (
	"encoding/json"
	"html/template"
	"log"
	"net/http"
	"time"

	"github.com/Twarga/Nodi/internal/auth"
	"github.com/Twarga/Nodi/internal/config"

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
		if r.Method == http.MethodGet {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			tmpl, err := template.ParseFiles("web/templates/layout.html", "web/templates/login.html")
			if err != nil {
				log.Printf("Template parsing error: %v", err)
				http.Error(w, "Internal Server Error", http.StatusInternalServerError)
				return
			}

			if err := tmpl.ExecuteTemplate(w, "layout.html", nil); err != nil {
				log.Printf("Template execution error: %v", err)
			}
			return
		}

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
			json.NewEncoder(w).Encode(LoginResponse{Success: false, Message: "Invalid credentials"})
			return
		}

		// Always run bcrypt comparison to prevent timing-based username enumeration.
		// Even if username is wrong, we compare against the stored hash so the timing
		// is identical to a correct username with wrong password.
		bcryptErr := bcrypt.CompareHashAndPassword([]byte(cfg.PassHash), []byte(req.Password))

		if req.Username != cfg.User || bcryptErr != nil {
			log.Printf("Failed login attempt for user %s", req.Username)
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
			Secure:   isSecureRequest(r),
			SameSite: http.SameSiteStrictMode,
			Expires:  time.Now().Add(cfg.SessionExpiry),
		}
		http.SetCookie(w, &cookie)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(LoginResponse{Success: true})
	}
}

func isSecureRequest(r *http.Request) bool {
	return r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https"
}
