package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type Session struct {
	User string `json:"user"`
	Exp  int64  `json:"exp"`
}

func (s *Session) Expired() bool {
	return time.Unix(s.Exp, 0).Before(time.Now())
}

func (s *Session) IsValid(username string) bool {
	return !s.Expired() && s.User == username
}

func Create(username string, secret string, expiry time.Duration) (string, error) {
	exp := time.Now().Add(expiry).Unix()
	session := Session{
		User: username,
		Exp:  exp,
	}
	data, err := json.Marshal(session)
	if err != nil {
		return "", fmt.Errorf("json marshal: %w", err)
	}
	h := hmac.New(sha256.New, []byte(secret))
	h.Write(data)
	sig := h.Sum(nil)
	payload := base64.URLEncoding.EncodeToString(data)
	signature := base64.URLEncoding.EncodeToString(sig)
	return payload + "." + signature, nil
}

func Validate(token, secret string) (*Session, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return nil, fmt.Errorf("invalid token format")
	}
	payload, err := base64.URLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, fmt.Errorf("invalid payload encoding: %w", err)
	}
	signature, err := base64.URLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, fmt.Errorf("invalid signature encoding: %w", err)
	}
	h := hmac.New(sha256.New, []byte(secret))
	h.Write(payload)
	expectedMAC := h.Sum(nil)
	if !hmac.Equal(signature, expectedMAC) {
		return nil, fmt.Errorf("invalid signature")
	}
	var session Session
	if err := json.Unmarshal(payload, &session); err != nil {
		return nil, fmt.Errorf("json unmarshal: %w", err)
	}
	if session.Expired() {
		return nil, fmt.Errorf("session expired")
	}
	return &session, nil
}

func GetExpiry(token string) (int64, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return 0, fmt.Errorf("invalid token format")
	}
	payload, err := base64.URLEncoding.DecodeString(parts[0])
	if err != nil {
		return 0, err
	}
	var session Session
	if err := json.Unmarshal(payload, &session); err != nil {
		return 0, err
	}
	return session.Exp, nil
}

func SetCookie(sessionToken string, maxAge int) string {
	cookie := fmt.Sprintf(
		"ql_session=%s; Path=/; HttpOnly; SameSite=Strict; Max-Age=%d",
		sessionToken,
		maxAge,
	)
	return cookie
}

func ClearCookie() string {
	return "ql_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0"
}

func GetSessionFromRequest(r *http.Request, secret string) (*Session, error) {
	cookie, err := r.Cookie("ql_session")
	if err != nil {
		return nil, fmt.Errorf("no session cookie: %w", err)
	}
	return Validate(cookie.Value, secret)
}
