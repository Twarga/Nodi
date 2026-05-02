# Nodi

<p align="center">
  <img src="./logo.png" alt="Nodi logo" width="180" />
</p>

<p align="center">
  A lightweight, self-hosted web file manager built for speed, security, and a quiet technical aesthetic.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Go-1.26+-1f1f1f?style=flat-square&logo=go&logoColor=00ADD8" alt="Go" />
  <img src="https://img.shields.io/badge/Vanilla_JS-Frontend-1f1f1f?style=flat-square&logo=javascript&logoColor=F7DF1E" alt="Vanilla JS" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3.4-1f1f1f?style=flat-square&logo=tailwindcss&logoColor=38BDF8" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Docker-Packaging-1f1f1f?style=flat-square&logo=docker&logoColor=2496ED" alt="Docker" />
  <img src="https://img.shields.io/badge/Alpine-Linux-1f1f1f?style=flat-square&logo=alpinelinux&logoColor=white" alt="Alpine" />
</p>

## What it is

Nodi is a minimalist file management solution for users who value density and performance. It serves as a private cloud alternative that runs directly on your hardware, providing a monastic interface for interacting with your local files.

## Core workflow

1. Authenticate securely via BCrypt-backed login
2. Browse directories with zero-latency SPA navigation
3. Manage assets with async Rename, Create, and Delete actions
4. Track large uploads with real-time UI progress bars
5. Toggle between Light and Dark modes instantly

## Tech stack

- **Backend**: Go (standard library + `http.ServeMux`)
- **Frontend**: Vanilla JavaScript (ES Modules)
- **Styling**: Tailwind CSS v3
- **Packaging**: Multi-stage Docker build
- **OS**: Alpine Linux

## Status

**MVP deployment ready.** The core self-hosted file manager flow is covered by Go integration tests: login, dashboard, static assets, browse, create folder, upload, download, rename, delete, and root-escape rejection.

## Deployment (Fast Install)

Run the one-click installer on any Linux server with Docker installed:

```bash
curl -fsSL https://raw.githubusercontent.com/Twarga/Nodi/main/install.sh | bash
```

The installer creates `./nodi-app`, writes `nodi.env`, pulls `ghcr.io/twarga/nodi:latest`, and starts Docker Compose. Default local credentials are `admin / admin`; change `QL_USER` and `QL_PASS_HASH` in `nodi.env` before exposing the app outside a trusted network.

Useful installer overrides:

```bash
curl -fsSL https://raw.githubusercontent.com/Twarga/Nodi/main/install.sh | NODI_PORT=9090 INSTALL_DIR=/opt/nodi bash
```

## Docker

Run from a clone:

```bash
cp .env.example nodi.env
docker compose up -d
```

The compose file uses a named `nodi-data` volume mounted at `/data`.

## Development

Prerequisites:
- [Go 1.26+](https://go.dev/)
- [Docker](https://www.docker.com/) (optional)

To start the project locally for testing:

```bash
chmod +x run.sh
./run.sh
```

This will download the Tailwind CLI, compile the CSS, scaffold a default `.env`, and start the server.

## License
MIT License. Created by [Twarga](https://github.com/Twarga).
