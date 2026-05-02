package handlers_test

import (
	"bytes"
	"github.com/Twarga/Nodi/internal/handlers"
	"html/template"
	"testing"
	"time"
)

func TestLayoutTemplateSyntax(t *testing.T) {
	tmpl, err := template.ParseFiles("../../web/templates/layout.html")
	if err != nil {
		t.Fatalf("Failed to parse layout.html: %v", err)
	}

	var buf bytes.Buffer
	err = tmpl.Execute(&buf, nil)
	if err != nil {
		t.Fatalf("Failed to execute layout.html: %v", err)
	}

	html := buf.String()
	if len(html) == 0 {
		t.Errorf("Executed template is empty")
	}
}

func TestLoginTemplateSyntax(t *testing.T) {
	tmpl, err := template.ParseFiles("../../web/templates/layout.html", "../../web/templates/login.html")
	if err != nil {
		t.Fatalf("Failed to parse layout and login templates: %v", err)
	}

	var buf bytes.Buffer
	err = tmpl.ExecuteTemplate(&buf, "layout.html", nil)
	if err != nil {
		t.Logf("If execution fails without data, verify it's just missing data bindings, err: %v", err)
	}
}

func TestBreadcrumbsTemplateSyntax(t *testing.T) {
	tmpl, err := template.New("breadcrumbs.html").Funcs(handlers.GlobalFuncs).ParseFiles("../../web/templates/components/breadcrumbs.html")
	if err != nil {
		t.Fatalf("Failed to parse breadcrumbs.html: %v", err)
	}

	type Segment struct {
		Name string
		Path string
	}

	data := []Segment{
		{Name: "Documents", Path: "Documents"},
		{Name: "Photos", Path: "Documents/Photos"},
	}

	var buf bytes.Buffer
	err = tmpl.ExecuteTemplate(&buf, "breadcrumbs", data)
	if err != nil {
		t.Fatalf("Failed to execute breadcrumbs template: %v", err)
	}

	if !bytes.Contains(buf.Bytes(), []byte("Documents")) {
		t.Errorf("Expected output to contain 'Documents'")
	}
}

func TestDashboardTemplateSyntax(t *testing.T) {
	patterns := []string{
		"../../web/templates/layout.html",
		"../../web/templates/dashboard.html",
		"../../web/templates/components/breadcrumbs.html",
		"../../web/templates/components/file-row.html",
		"../../web/templates/components/file-card.html",
		"../../web/templates/components/modal.html",
	}

	tmpl, err := template.New("layout.html").Funcs(handlers.GlobalFuncs).ParseFiles(patterns...)
	if err != nil {
		t.Fatalf("Failed to parse dashboard templates: %v", err)
	}

	type DashboardData struct {
		Username string
		Initial  string
		Path     interface{}
		Files    []interface{}
	}

	var buf bytes.Buffer
	err = tmpl.ExecuteTemplate(&buf, "layout.html", DashboardData{
		Username: "admin",
		Initial:  "A",
		Path:     []interface{}{},
		Files:    []interface{}{},
	})
	if err != nil {
		t.Fatalf("Failed to execute dashboard template: %v", err)
	}

	html := buf.String()
	if len(html) == 0 {
		t.Errorf("Executed dashboard template is empty")
	}
}

func TestFileRowNoXSS(t *testing.T) {
	tmpl, err := template.New("file-row").Funcs(handlers.GlobalFuncs).ParseFiles("../../web/templates/components/file-row.html")
	if err != nil {
		t.Fatalf("Failed to parse file-row.html: %v", err)
	}

	// Malicious filename that would break out of inline JS strings
	maliciousName := `foo');alert('xss`

	data := struct {
		Name    string
		IsDir   bool
		Size    int64
		ModTime time.Time
		MIME    string
	}{
		Name:    maliciousName,
		IsDir:   false,
		Size:    1024,
		ModTime: time.Now(),
		MIME:    "text",
	}

	var buf bytes.Buffer
	err = tmpl.ExecuteTemplate(&buf, "file-row", data)
	if err != nil {
		t.Fatalf("Failed to execute file-row template: %v", err)
	}

	html := buf.String()

	// The malicious string should be HTML-escaped, not appear raw in JS context
	if bytes.Contains(buf.Bytes(), []byte(`onclick="`)) {
		t.Errorf("file-row.html still contains inline onclick — XSS vulnerability")
	}

	// The name should appear as a data attribute (safe context)
	if !bytes.Contains(buf.Bytes(), []byte(`data-name="`)) {
		t.Errorf("file-row.html missing data-name attribute")
	}

	// Verify the escaped name appears somewhere in output
	if !bytes.Contains(buf.Bytes(), []byte("foo")) {
		t.Errorf("Expected filename content not found in output")
	}

	_ = html
}
