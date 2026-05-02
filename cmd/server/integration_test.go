package main

import (
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"nodi/internal/config"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"
)

func TestFileManagerEndToEnd(t *testing.T) {
	wd, err := os.Getwd()
	if err != nil {
		t.Fatalf("get cwd: %v", err)
	}
	if err := os.Chdir("../.."); err != nil {
		t.Fatalf("chdir repo root: %v", err)
	}
	defer os.Chdir(wd)

	root, err := os.MkdirTemp("", "nodi-e2e-root-*")
	if err != nil {
		t.Fatalf("temp root: %v", err)
	}
	defer os.RemoveAll(root)

	passHash, err := bcrypt.GenerateFromPassword([]byte("admin"), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}

	cfg := &config.Config{
		User:          "admin",
		PassHash:      string(passHash),
		Root:          root,
		CookieSecret:  "integration-secret-32-bytes-long",
		MaxUpload:     1 << 20,
		SessionExpiry: time.Hour,
	}
	server := httptest.NewServer(NewHandler(cfg))
	defer server.Close()

	client := server.Client()

	staticResp, err := client.Get(server.URL + "/static/app.js")
	if err != nil {
		t.Fatalf("get static asset: %v", err)
	}
	staticResp.Body.Close()
	if staticResp.StatusCode != http.StatusOK {
		t.Fatalf("expected static status 200, got %d", staticResp.StatusCode)
	}

	cookie := loginForTest(t, client, server.URL)

	getWithCookie := func(path string) *http.Response {
		req, err := http.NewRequest(http.MethodGet, server.URL+path, nil)
		if err != nil {
			t.Fatalf("new get request: %v", err)
		}
		req.AddCookie(cookie)
		resp, err := client.Do(req)
		if err != nil {
			t.Fatalf("get %s: %v", path, err)
		}
		return resp
	}
	postJSON := func(path string, body any) *http.Response {
		payload, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal %s: %v", path, err)
		}
		req, err := http.NewRequest(http.MethodPost, server.URL+path, bytes.NewReader(payload))
		if err != nil {
			t.Fatalf("new post request: %v", err)
		}
		req.Header.Set("Content-Type", "application/json")
		req.AddCookie(cookie)
		resp, err := client.Do(req)
		if err != nil {
			t.Fatalf("post %s: %v", path, err)
		}
		return resp
	}

	dashboardResp := getWithCookie("/")
	dashboardBody, _ := io.ReadAll(dashboardResp.Body)
	dashboardResp.Body.Close()
	if dashboardResp.StatusCode != http.StatusOK || !strings.Contains(string(dashboardBody), "Nodi") {
		t.Fatalf("expected dashboard shell, got status %d body %q", dashboardResp.StatusCode, string(dashboardBody))
	}

	browseResp := getWithCookie("/browse")
	browseBody, _ := io.ReadAll(browseResp.Body)
	browseResp.Body.Close()
	if browseResp.StatusCode != http.StatusOK || strings.TrimSpace(string(browseBody)) != "[]" {
		t.Fatalf("expected empty browse array, got status %d body %q", browseResp.StatusCode, string(browseBody))
	}

	createResp := postJSON("/api/folder/create", map[string]string{"path": "/", "name": "docs"})
	createResp.Body.Close()
	if createResp.StatusCode != http.StatusCreated {
		t.Fatalf("expected create folder status 201, got %d", createResp.StatusCode)
	}

	uploadResp := uploadForTest(t, client, server.URL, cookie, "/docs", "note.txt", "hello")
	uploadResp.Body.Close()
	if uploadResp.StatusCode != http.StatusOK {
		t.Fatalf("expected upload status 200, got %d", uploadResp.StatusCode)
	}

	downloadResp := getWithCookie("/api/download?path=/docs/note.txt")
	downloadBody, _ := io.ReadAll(downloadResp.Body)
	downloadResp.Body.Close()
	if downloadResp.StatusCode != http.StatusOK || string(downloadBody) != "hello" {
		t.Fatalf("expected downloaded body, got status %d body %q", downloadResp.StatusCode, string(downloadBody))
	}

	renameResp := postJSON("/api/rename", map[string]string{"oldPath": "/docs/note.txt", "newName": "renamed.txt"})
	renameResp.Body.Close()
	if renameResp.StatusCode != http.StatusOK {
		t.Fatalf("expected rename status 200, got %d", renameResp.StatusCode)
	}

	deleteResp := postJSON("/api/delete", map[string]string{"path": "/docs/renamed.txt"})
	deleteResp.Body.Close()
	if deleteResp.StatusCode != http.StatusOK {
		t.Fatalf("expected delete status 200, got %d", deleteResp.StatusCode)
	}

	assertTraversalAndSymlinkRejected(t, root, getWithCookie)
}

func loginForTest(t *testing.T, client *http.Client, baseURL string) *http.Cookie {
	t.Helper()

	payload := strings.NewReader(`{"username":"admin","password":"admin"}`)
	resp, err := client.Post(baseURL+"/login", "application/json", payload)
	if err != nil {
		t.Fatalf("login: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected login status 200, got %d body %q", resp.StatusCode, string(body))
	}
	for _, cookie := range resp.Cookies() {
		if cookie.Name == "ql_session" {
			return cookie
		}
	}
	t.Fatal("login did not return ql_session cookie")
	return nil
}

func uploadForTest(t *testing.T, client *http.Client, baseURL string, cookie *http.Cookie, path, name, contents string) *http.Response {
	t.Helper()

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	if err := writer.WriteField("path", path); err != nil {
		t.Fatalf("write path field: %v", err)
	}
	part, err := writer.CreateFormFile("files", name)
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}
	if _, err := part.Write([]byte(contents)); err != nil {
		t.Fatalf("write upload contents: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close multipart writer: %v", err)
	}

	req, err := http.NewRequest(http.MethodPost, baseURL+"/api/upload", body)
	if err != nil {
		t.Fatalf("new upload request: %v", err)
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.AddCookie(cookie)

	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("upload request: %v", err)
	}
	return resp
}

func assertTraversalAndSymlinkRejected(t *testing.T, root string, getWithCookie func(path string) *http.Response) {
	t.Helper()

	sibling := root + "-evil"
	if err := os.MkdirAll(sibling, 0755); err != nil {
		t.Fatalf("create sibling: %v", err)
	}
	defer os.RemoveAll(sibling)

	traversalResp := getWithCookie("/browse?path=../" + filepath.Base(sibling))
	traversalResp.Body.Close()
	if traversalResp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected traversal status 403, got %d", traversalResp.StatusCode)
	}

	outside, err := os.MkdirTemp("", "nodi-e2e-outside-*")
	if err != nil {
		t.Fatalf("temp outside: %v", err)
	}
	defer os.RemoveAll(outside)

	if err := os.Symlink(outside, filepath.Join(root, "outside-link")); err != nil {
		t.Fatalf("create symlink: %v", err)
	}
	symlinkResp := getWithCookie("/browse?path=/outside-link")
	symlinkResp.Body.Close()
	if symlinkResp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected symlink status 403, got %d", symlinkResp.StatusCode)
	}
}
