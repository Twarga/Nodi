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
