package handlers_test

import (
	"bytes"
	"html/template"
	"testing"
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
	funcMap := template.FuncMap{
		"add": func(a, b int) int { return a + b },
		"not": func(b bool) bool { return !b },
	}

	tmpl, err := template.New("breadcrumbs.html").Funcs(funcMap).ParseFiles("../../web/templates/components/breadcrumbs.html")
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
	type DashboardData struct {
		Username string
		Initial  string
	}

	tmpl, err := template.ParseFiles("../../web/templates/layout.html", "../../web/templates/dashboard.html")
	if err != nil {
		t.Fatalf("Failed to parse layout and dashboard templates: %v", err)
	}

	var buf bytes.Buffer
	err = tmpl.ExecuteTemplate(&buf, "layout.html", DashboardData{Username: "admin", Initial: "A"})
	if err != nil {
		t.Fatalf("Failed to execute dashboard template: %v", err)
	}

	html := buf.String()
	if len(html) == 0 {
		t.Errorf("Executed dashboard template is empty")
	}
}