package handlers

import (
	"fmt"
	"html/template"
	"net/http"
	"time"
)

// GlobalFuncs provides common helper functions for HTML templates.
var GlobalFuncs = template.FuncMap{
	"add": func(a, b int) int { return a + b },
	"formatBytes": func(b int64) string {
		const unit = 1024
		if b < unit {
			return fmt.Sprintf("%d B", b)
		}
		div, exp := int64(unit), 0
		for n := b / unit; n >= unit; n /= unit {
			div *= unit
			exp++
		}
		return fmt.Sprintf("%.1f %cB", float64(b)/float64(div), "KMGTPE"[exp])
	},
	"formatRelative": func(t time.Time) string {
		now := time.Now()
		diff := now.Sub(t)
		if diff < time.Minute {
			return "just now"
		}
		if diff < time.Hour {
			return fmt.Sprintf("%dm ago", int(diff.Minutes()))
		}
		if diff < 24*time.Hour {
			return fmt.Sprintf("%dh ago", int(diff.Hours()))
		}
		if diff < 7*24*time.Hour {
			return fmt.Sprintf("%dd ago", int(diff.Hours()/24))
		}
		return t.Format("2006-01-02")
	},
}

// RenderTemplate is a helper to parse and execute patterns with GlobalFuncs.
func RenderTemplate(w http.ResponseWriter, data interface{}, patterns ...string) {
	tmpl, err := template.New("base").Funcs(GlobalFuncs).ParseFiles(patterns...)
	if err != nil {
		http.Error(w, "Template Error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	
	// By default executes the first pattern's filename (e.g. layout.html)
	// But we use layout.html as the primary wrapper.
	err = tmpl.ExecuteTemplate(w, "layout.html", data)
	if err != nil {
		// Log error but we might have already written headers
		fmt.Printf("Execution Error: %v\n", err)
	}
}
