package handlers_test

import (
	"bytes"
	"html/template"
	"testing"
)

func TestLayoutTemplateSyntax(t *testing.T) {
	// Simple test to ensure the template is syntactically valid
	tmpl, err := template.ParseFiles("../../web/templates/layout.html")
	if err != nil {
		t.Fatalf("Failed to parse layout.html: %v", err)
	}

	// Try executing it with empty data
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
