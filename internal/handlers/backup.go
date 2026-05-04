package handlers

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/Twarga/Nodi/internal/config"
	"github.com/Twarga/Nodi/internal/storage"
)

var backupSkip = map[string]bool{
	".trash": true,
	".cache": true,
}

func Backup(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		dateStr := time.Now().UTC().Format("2006-01-02")
		w.Header().Set("Content-Type", "application/zip")
		w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="nodi-backup-%s.zip"`, dateStr))

		zw := zip.NewWriter(w)
		defer zw.Close()

		filepath.WalkDir(cfg.Root, func(path string, d os.DirEntry, err error) error {
			if err != nil {
				return nil
			}
			rel, _ := filepath.Rel(cfg.Root, path)
			rel = filepath.ToSlash(rel)

			// Skip top-level entries in the skip list
			parts := strings.Split(rel, "/")
			if len(parts) > 0 && backupSkip[parts[0]] {
				if d.IsDir() {
					return filepath.SkipDir
				}
				return nil
			}

			if d.IsDir() {
				return nil
			}

			info, err := d.Info()
			if err != nil {
				return nil
			}

			header, err := zip.FileInfoHeader(info)
			if err != nil {
				return nil
			}
			header.Name = rel
			header.Method = zip.Deflate

			out, err := zw.CreateHeader(header)
			if err != nil {
				return nil
			}

			f, err := os.Open(path)
			if err != nil {
				return nil
			}
			io.Copy(out, f)
			f.Close()
			return nil
		})

		storage.Append(cfg.Root, storage.ActivityEvent{
			User:   sessionUserFromCtx(r.Context()),
			Action: "backup",
			Path:   "/",
		})
	}
}

func RestoreBackup(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		confirm := r.Header.Get("X-Confirm")
		if confirm != "DELETE" {
			http.Error(w, "Confirmation required: set X-Confirm header to DELETE", http.StatusBadRequest)
			return
		}

		maxUpload := cfg.MaxUpload
		if maxUpload <= 0 {
			maxUpload = 2147483648
		}
		r.Body = http.MaxBytesReader(w, r.Body, maxUpload)

		if err := r.ParseMultipartForm(32 << 20); err != nil {
			http.Error(w, "Failed to parse form: "+err.Error(), http.StatusBadRequest)
			return
		}

		file, _, err := r.FormFile("file")
		if err != nil {
			http.Error(w, "No file uploaded", http.StatusBadRequest)
			return
		}
		defer file.Close()

		tmpDir, err := os.MkdirTemp(cfg.Root, ".nodi-restore-*")
		if err != nil {
			http.Error(w, "Failed to create temp dir", http.StatusInternalServerError)
			return
		}

		tmpZip := filepath.Join(tmpDir, "upload.zip")
		out, err := os.Create(tmpZip)
		if err != nil {
			os.RemoveAll(tmpDir)
			http.Error(w, "Failed to create temp file", http.StatusInternalServerError)
			return
		}
		if _, err := io.Copy(out, file); err != nil {
			out.Close()
			os.RemoveAll(tmpDir)
			http.Error(w, "Failed to save upload", http.StatusInternalServerError)
			return
		}
		out.Close()

		// Open and extract
		zr, err := zip.OpenReader(tmpZip)
		if err != nil {
			os.RemoveAll(tmpDir)
			http.Error(w, "Invalid zip file", http.StatusBadRequest)
			return
		}
		defer zr.Close()

		for _, f := range zr.File {
			// Zip slip check
			target := filepath.Join(cfg.Root, filepath.FromSlash(f.Name))
			cleanTarget := filepath.Clean(target)
			if !strings.HasPrefix(cleanTarget, filepath.Clean(cfg.Root)+string(filepath.Separator)) && cleanTarget != filepath.Clean(cfg.Root) {
				continue
			}

			if f.FileInfo().IsDir() {
				os.MkdirAll(target, 0755)
				continue
			}

			rc, err := f.Open()
			if err != nil {
				continue
			}

			os.MkdirAll(filepath.Dir(target), 0755)
			outFile, err := os.Create(target)
			if err != nil {
				rc.Close()
				continue
			}
			io.Copy(outFile, rc)
			outFile.Close()
			rc.Close()
		}

		// Clean up temp dir
		os.RemoveAll(tmpDir)

		storage.Append(cfg.Root, storage.ActivityEvent{
			User:   sessionUserFromCtx(r.Context()),
			Action: "restore",
			Path:   "/",
		})

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]bool{"success": true})
	}
}
