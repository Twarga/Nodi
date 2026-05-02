package handlers

import (
	"fmt"
	"html/template"
	"net/http"
	"reflect"
	"time"

	"github.com/Twarga/Nodi/internal/middleware"
)

// GlobalFuncs provides common helper functions for HTML templates.
var GlobalFuncs = template.FuncMap{
	"add": func(a, b int) int { return a + b },
	"dict": func(values ...interface{}) (map[string]interface{}, error) {
		if len(values)%2 != 0 {
			return nil, fmt.Errorf("invalid dict call")
		}
		dict := make(map[string]interface{}, len(values)/2)
		for i := 0; i < len(values); i += 2 {
			key, ok := values[i].(string)
			if !ok {
				return nil, fmt.Errorf("dict keys must be strings")
			}
			dict[key] = values[i+1]
		}
		return dict, nil
	},
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
	"fileKey": func(name string) string {
		// Match the JS fileKey() logic: replace non-alphanumeric with underscore
		b := make([]byte, len(name))
		for i, c := range []byte(name) {
			if (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') {
				b[i] = c
			} else {
				b[i] = '_'
			}
		}
		return string(b)
	},
}

// RenderTemplate parses and executes templates with nonce injection.
func RenderTemplate(w http.ResponseWriter, r *http.Request, data interface{}, patterns ...string) {
	// Automatically inject CSP nonce if not already in data
	nonce := middleware.GetNonce(r)
	if nonce != "" && data != nil {
		v := reflect.ValueOf(data)
		if v.Kind() == reflect.Ptr {
			v = v.Elem()
		}
		if v.Kind() == reflect.Struct {
			f := v.FieldByName("Nonce")
			if f.IsValid() && f.CanSet() && f.Kind() == reflect.String && f.String() == "" {
				f.SetString(nonce)
			}
		}
	}

	tmpl, err := template.New("base").Funcs(GlobalFuncs).ParseFiles(patterns...)
	if err != nil {
		http.Error(w, "Template Error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	err = tmpl.ExecuteTemplate(w, "layout.html", data)
	if err != nil {
		fmt.Printf("Execution Error: %v\n", err)
	}
}
