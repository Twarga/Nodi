# Nodi Release Checklist

This document tracks what must be true before each Nodi release.

## Pre-Release Verification

### Automated Checks (run on every commit)

- [ ] `go test ./...` passes
- [ ] `npm run build` passes (from `web/app`)
- [ ] Docker image builds locally: `docker build -t nodi:test .`
- [ ] GHCR workflow `.github/workflows/docker-publish.yml` is green on `main`
- [ ] Trivy security scan shows no critical vulnerabilities

### Large-File Safety

- [ ] Upload a 20 GB file over LAN and verify it completes without corruption
- [ ] Upload a 100 GB file over LAN and verify it completes without corruption
- [ ] Pause Wi-Fi mid-upload and confirm resume works
- [ ] Close browser mid-upload and confirm resume works after reopening
- [ ] Upload a folder with 10,000 files and preserve structure
- [ ] Verify disk-full behavior: start an upload when disk is nearly full and confirm a clear human error message is shown
- [ ] Verify abandoned upload cleanup after TTL expires

### Security

- [ ] No default public admin credentials in release paths (installer, Docker, K8s)
- [ ] Cookie secret is random and not a known unsafe default
- [ ] Share tokens are hashed in storage, not stored in plain text
- [ ] Passwords are never in URLs
- [ ] Share HTML uses `html/template` escaping
- [ ] Run security scan (Trivy / `govulncheck` / equivalent)

### Sharing

- [ ] Share a password-protected folder and verify the password does not appear in the URL
- [ ] Create a public dropbox and upload from another device
- [ ] Verify share revocation works
- [ ] Verify expiring links expire correctly

### Cross-Device Access

- [ ] Mount via WebDAV from at least one desktop OS (Windows / macOS / Linux)
- [ ] Upload from a phone browser
- [ ] Scan the QR code on the Devices page and verify it opens Nodi

### Trash and Recovery

- [ ] Restore deleted files from trash
- [ ] Verify trash retention cleanup removes old items
- [ ] Verify restore does not silently overwrite existing files

### Packaging

- [ ] `docker pull ghcr.io/twarga/nodi:latest` works
- [ ] Image starts with mounted `/nodi_files`
- [ ] Image works with `QL_PASS_HASH` or `QL_BOOTSTRAP_PASSWORD`
- [ ] Image does not require writable root filesystem beyond intended volumes
- [ ] Kubernetes manifests apply cleanly: `kubectl apply -k deploy/kubernetes`
- [ ] Installer script works on a fresh machine: `bash <(curl ...)`

### Frontend Acceptance

- [ ] Every page (`/`, `/files`, `/send`, `/share`, `/devices`, `/settings`, `/login`) reviewed on desktop, tablet, and mobile
- [ ] No card chrome on hero/sections/page containers (forms and modals may be card surfaces)
- [ ] Dark mode renders correctly on every page with visible hairline borders and adequate contrast
- [ ] Touch targets ≥ 44 px on mobile
- [ ] No horizontal scroll on 375 px viewport
- [ ] `npm run build` produces CSS ≤ 50 kB and JS ≤ 250 kB gzipped
- [ ] Focus rings are visible; keyboard navigation works end-to-end
- [ ] Upload panel "clear" button only removes done/skipped/error items, never active uploads
- [ ] Share expiry inputs are converted to RFC3339 before sending to backend

## Release Steps

1. Run all automated checks locally.
2. Run all real-device verification gates above.
3. Update version string in `cmd/server/main.go`.
4. Tag the release: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`.
5. Push the tag: `git push origin vX.Y.Z`.
6. Wait for GHCR workflow to publish the image.
7. Verify `docker pull ghcr.io/twarga/nodi:vX.Y.Z`.
8. Update `README.md` release status section.
9. Publish GitHub release notes with breaking changes, migration notes, and security advisories.

## Post-Release

- [ ] Verify the Kubernetes manifest still points to a valid tag (or `latest` if desired).
- [ ] Monitor first 24 hours for issues reported by early adopters.
- [ ] Update migration notes if any breaking changes were introduced.
