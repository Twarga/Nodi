package handlers

import (
	"archive/tar"
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
	".trash":          true,
	".cache":          true,
	".nodifav.json":   true,
	".nodilog.jsonl":  true,
	".nodishare.json": true,
}

func Backup(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		dateStr := time.Now().UTC().Format("2006-01-02")
		if r.URL.Query().Get("format") == "zip" {
			w.Header().Set("Content-Type", "application/zip")
			w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="nodi-backup-%s.zip"`, dateStr))
			if err := writeZipBackup(w, cfg.Root); err != nil {
				return
			}
		} else {
			w.Header().Set("Content-Type", "application/x-tar")
			w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="nodi-backup-%s.tar"`, dateStr))
			if err := writeTarBackup(w, cfg.Root); err != nil {
				return
			}
		}

		storage.Append(cfg.Root, storage.ActivityEvent{
			User:   sessionUserFromCtx(r.Context()),
			Action: "backup",
			Path:   "/",
		})
	}
}

func shouldSkipBackupPath(root, path string, d os.DirEntry) bool {
	rel, err := filepath.Rel(root, path)
	if err != nil || rel == "." {
		return false
	}
	rel = filepath.ToSlash(rel)
	parts := strings.Split(rel, "/")
	return len(parts) > 0 && (backupSkip[parts[0]] || strings.HasPrefix(parts[0], ".nodi-"))
}

func writeZipBackup(w io.Writer, root string) error {
	zw := zip.NewWriter(w)
	defer zw.Close()

	return filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if shouldSkipBackupPath(root, path, d) {
			if d.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		rel, _ := filepath.Rel(root, path)
		rel = filepath.ToSlash(rel)

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
}

func writeTarBackup(w io.Writer, root string) error {
	tw := tar.NewWriter(w)
	defer tw.Close()

	return filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if shouldSkipBackupPath(root, path, d) {
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
		rel, err := filepath.Rel(root, path)
		if err != nil {
			return nil
		}
		rel = filepath.ToSlash(rel)
		header, err := tar.FileInfoHeader(info, "")
		if err != nil {
			return nil
		}
		header.Name = rel
		if err := tw.WriteHeader(header); err != nil {
			return err
		}
		f, err := os.Open(path)
		if err != nil {
			return nil
		}
		_, copyErr := io.Copy(tw, f)
		closeErr := f.Close()
		if copyErr != nil {
			return copyErr
		}
		return closeErr
	})
}

func safeRestoreTarget(root, name string) (string, bool) {
	target := filepath.Join(root, filepath.FromSlash(name))
	cleanTarget := filepath.Clean(target)
	cleanRoot := filepath.Clean(root)
	if !strings.HasPrefix(cleanTarget, cleanRoot+string(filepath.Separator)) && cleanTarget != cleanRoot {
		return "", false
	}
	return cleanTarget, true
}

func restoreTarBackup(root string, reader io.Reader) error {
	tr := tar.NewReader(reader)
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return err
		}
		target, ok := safeRestoreTarget(root, hdr.Name)
		if !ok {
			continue
		}
		switch hdr.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(target, 0755); err != nil {
				return err
			}
		case tar.TypeReg, tar.TypeRegA:
			if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
				return err
			}
			outFile, err := os.Create(target)
			if err != nil {
				return err
			}
			_, copyErr := io.Copy(outFile, tr)
			closeErr := outFile.Close()
			if copyErr != nil {
				return copyErr
			}
			if closeErr != nil {
				return closeErr
			}
		}
	}
}

func restoreZipBackup(root, tmpZip string) error {
	zr, err := zip.OpenReader(tmpZip)
	if err != nil {
		return err
	}
	defer zr.Close()

	for _, f := range zr.File {
		target, ok := safeRestoreTarget(root, f.Name)
		if !ok {
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
	return nil
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

		mr, err := r.MultipartReader()
		if err != nil {
			http.Error(w, "Failed to read multipart upload: "+err.Error(), http.StatusBadRequest)
			return
		}

		tmpDir, err := os.MkdirTemp(cfg.Root, ".nodi-restore-*")
		if err != nil {
			http.Error(w, "Failed to create temp dir", http.StatusInternalServerError)
			return
		}

		tmpUpload := filepath.Join(tmpDir, "upload.backup")
		out, err := os.Create(tmpUpload)
		if err != nil {
			os.RemoveAll(tmpDir)
			http.Error(w, "Failed to create temp file", http.StatusInternalServerError)
			return
		}

		foundFile := false
		uploadedName := ""
		for {
			part, err := mr.NextPart()
			if err == io.EOF {
				break
			}
			if err != nil {
				out.Close()
				os.RemoveAll(tmpDir)
				http.Error(w, "Failed to read upload", http.StatusBadRequest)
				return
			}
			if part.FormName() != "file" || part.FileName() == "" {
				part.Close()
				continue
			}
			foundFile = true
			uploadedName = strings.ToLower(part.FileName())
			_, err = io.Copy(out, part)
			part.Close()
			if err != nil {
				out.Close()
				os.RemoveAll(tmpDir)
				http.Error(w, "Failed to save upload", http.StatusInternalServerError)
				return
			}
			break
		}
		if err := out.Close(); err != nil {
			os.RemoveAll(tmpDir)
			http.Error(w, "Failed to save upload", http.StatusInternalServerError)
			return
		}
		if !foundFile {
			os.RemoveAll(tmpDir)
			http.Error(w, "No file uploaded", http.StatusBadRequest)
			return
		}

		if strings.HasSuffix(uploadedName, ".tar") {
			in, err := os.Open(tmpUpload)
			if err != nil {
				os.RemoveAll(tmpDir)
				http.Error(w, "Failed to open backup", http.StatusInternalServerError)
				return
			}
			err = restoreTarBackup(cfg.Root, in)
			in.Close()
			if err != nil {
				os.RemoveAll(tmpDir)
				http.Error(w, "Invalid tar file", http.StatusBadRequest)
				return
			}
		} else {
			if err := restoreZipBackup(cfg.Root, tmpUpload); err != nil {
				os.RemoveAll(tmpDir)
				http.Error(w, "Invalid zip file", http.StatusBadRequest)
				return
			}
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
