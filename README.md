# Nodi

<p align="center">
  <img src="./logo.png" alt="Nodi logo" width="180" />
</p>

<p align="center">
  A lightweight, self-hosted web file manager built for speed, security, and a quiet technical aesthetic.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Go-1.24+-1f1f1f?style=flat-square&logo=go&logoColor=00ADD8" alt="Go" />
  <img src="https://img.shields.io/badge/Preact-Frontend-1f1f1f?style=flat-square&logo=preact&logoColor=673AB8" alt="Preact" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4.0-1f1f1f?style=flat-square&logo=tailwindcss&logoColor=38BDF8" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Docker-Packaging-1f1f1f?style=flat-square&logo=docker&logoColor=2496ED" alt="Docker" />
  <img src="https://img.shields.io/badge/Alpine-Linux-1f1f1f?style=flat-square&logo=alpinelinux&logoColor=white" alt="Alpine" />
</p>

---

## 🎬 Demo

<p align="center">
  <video src="https://raw.githubusercontent.com/Twarga/Nodi/main/landing-page/nodi-demo.mp4" controls width="100%" style="max-width: 960px; border-radius: 12px;" />
</p>

<p align="center">
  <a href="https://twarga.github.io/Nodi/">Watch on the landing page →</a>
</p>

---

## What it is

Nodi is a LAN-first personal file hub for moving files across your own devices. It is designed around large browser uploads, drag-and-drop folders, mobile sending, safe sharing, and simple WebDAV access without becoming a full Nextcloud-style collaboration suite.

## Core workflow

1. Authenticate securely via BCrypt-backed login
2. Browse directories with zero-latency SPA navigation
3. Manage assets with async Rename, Create, and Delete actions
4. Upload large files with resumable chunked transfers
5. Send files from phone or laptop with a mobile-friendly upload screen
6. Share read-only links or upload dropboxes on your trusted network
7. Mount storage through WebDAV from desktop and mobile tools

## Tech stack

- **Backend**: Go (standard library + `http.ServeMux`)
- **Frontend**: Preact + Signals (lightweight React alternative)
- **Styling**: Tailwind CSS v4
- **Packaging**: Multi-stage Docker build
- **OS**: Alpine Linux

## Status

**Active remake.** The project is being rebuilt toward a practical home-network Drive alternative. The current focus is reliability for large uploads, mobile-first sending, safe sharing, WebDAV, trash/restore, health checks, and packaging that does not break 20GB-100GB transfers.

## Deployment (Fast Install)

Run the one-click installer on any Linux server with Docker installed. It **always builds from the latest source** and creates a **systemd service** so Nodi auto-starts on boot.

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/Twarga/Nodi/main/install.sh)
```

The installer clones the repo, builds a fresh Docker image, starts Nodi on port **7319**, and registers it with `systemd`. It generates a one-time admin password and prints it at the end of installation. Save it, log in, then change the password from Settings before exposing Nodi outside a trusted network.

Nodi is safest as a LAN-only app. If you expose it remotely, put it behind HTTPS and a firewall/reverse proxy you understand.

**Custom install directory:**

```bash
INSTALL_DIR=/opt/nodi bash <(curl -fsSL https://raw.githubusercontent.com/Twarga/Nodi/main/install.sh)
```

**Manage Nodi:**

```bash
sudo systemctl status nodi     # check status
sudo systemctl stop nodi       # stop
sudo systemctl start nodi      # start
sudo systemctl restart nodi    # restart
```

**Remove completely:**

```bash
sudo systemctl stop nodi && sudo systemctl disable nodi
sudo rm /etc/systemd/system/nodi.service
sudo systemctl daemon-reload
cd nodi-app && docker compose down -v && cd .. && rm -rf nodi-app
```

## Docker

Run from a clone:

```bash
cp .env.example nodi.env
docker compose up -d
```

The compose file uses named volumes mounted at `/nodi_files` and `/tmp`. Large uploads stream to disk; the default compose intentionally avoids tmpfs upload storage and tight memory caps.

Optional HTTPS reverse proxy with Caddy:

```bash
cp Caddyfile.example Caddyfile
# Edit Caddyfile and replace nodi.example.com with your hostname.
docker compose -f docker-compose.yml -f docker-compose.caddy.yml up -d
```

Use the Caddy setup only when you have DNS, firewall, and exposure rules under control. For home-only use, `http://server-ip:7319` is simpler.

## Development

Prerequisites:
- [Go 1.24+](https://go.dev/)
- [Docker](https://www.docker.com/) (optional)

## Quick Start (Local)

Run the full app with one command:

```bash
./run.sh
```

This installs frontend dependencies, builds the UI, scaffolds a default `.env`, and starts the Go server.

**Requires:** Go 1.24+, Node.js 20+, npm

Default credentials: `admin` / `admin` — change these before exposing to a network.

## License

MIT License. Created by [Twarga](https://github.com/Twarga).
