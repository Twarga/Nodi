package handlers

import (
	"fmt"
	"html/template"
	"net/http"
	"reflect"
	"sync"
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

var (
	tmplCache = make(map[string]*template.Template)
	tmplMu    sync.RWMutex
)

// InitTemplates parses all templates once at startup. Safe to call multiple times.
func InitTemplates() error {
	tmplMu.Lock()
	defer tmplMu.Unlock()

	// Skip if already initialized
	if len(tmplCache) > 0 {
		return nil
	}

	patterns := map[string][]string{
		"login": {
			"web/templates/layout.html",
			"web/templates/login.html",
		},
	}

	for key, files := range patterns {
		tmpl, err := template.New("layout.html").Funcs(GlobalFuncs).ParseFiles(files...)
		if err != nil {
			return fmt.Errorf("parse template %s: %w", key, err)
		}
		tmplCache[key] = tmpl
	}

	return nil
}

// GetCachedTemplate returns a parsed template by cache key.
func GetCachedTemplate(key string) *template.Template {
	tmplMu.RLock()
	tmpl := tmplCache[key]
	tmplMu.RUnlock()
	if tmpl == nil {
		// Try to initialize on demand (for tests)
		InitTemplates()
		tmplMu.RLock()
		tmpl = tmplCache[key]
		tmplMu.RUnlock()
	}
	return tmpl
}

// RenderTemplate executes a cached template with nonce injection.
func RenderTemplate(w http.ResponseWriter, r *http.Request, data interface{}, patterns ...string) {
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

	// Use cache key derived from first pattern for lookup
	cacheKey := "login"
	if len(patterns) >= 2 && patterns[1] == "web/templates/login.html" {
		cacheKey = "login"
	}

	tmpl := GetCachedTemplate(cacheKey)
	if tmpl == nil {
		http.Error(w, "Template not found", http.StatusInternalServerError)
		return
	}

	// Clone the template so concurrent requests get fresh execution state
	tmplClone, err := tmpl.Clone()
	if err != nil {
		http.Error(w, "Template Error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	err = tmplClone.ExecuteTemplate(w, "layout.html", data)
	if err != nil {
		fmt.Printf("Execution Error: %v\n", err)
	}
}
