# Nodi

<p align="center">
  <img src="./logo.png" alt="Nodi logo" width="180" />
</p>

<p align="center">
  Lightweight, self-hosted web file manager for homelabs and personal cloud replacement.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Go-Backend-1f1f1f?style=flat-square&logo=go&logoColor=00ADD8" alt="Go" />
  <img src="https://img.shields.io/badge/Vanilla_JS-Frontend-1f1f1f?style=flat-square&logo=javascript&logoColor=F7DF1E" alt="Vanilla JS" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-UI-1f1f1f?style=flat-square&logo=tailwindcss&logoColor=38BDF8" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Docker-Container-1f1f1f?style=flat-square&logo=docker&logoColor=2496ED" alt="Docker" />
  <img src="https://img.shields.io/badge/Alpine-Linux-1f1f1f?style=flat-square&logo=alpinelinux&logoColor=0D597F" alt="Alpine Linux" />
</p>

## What it is

Nodi is a minimalist, self-hosted web file manager designed to run on low-resource hardware with zero dependencies beyond a single binary and a Docker container.

## Core workflow

1. Log in via web interface securely.
2. Browse directories simply via breadcrumbs.
3. Upload files seamlessly via drag-and-drop.
4. Manage your assets (download, rename, delete) through a fast, responsive interface.
5. All operations run directly on the local filesystem.

## Tech stack

- Go 1.22+
- Vanilla JavaScript
- Tailwind CSS
- Alpine Linux Base (Docker)
- Minimal HTTP / Templates

## Status

Early development. The architecture leverages zero external UI frameworks (No React, Vue, HTMX) providing absolute native web speeds wrapped in heavily polished styling.

## Quick Start (Docker)

```yaml
services:
  nodi:
    image: twarga/nodi:latest
    container_name: nodi
    restart: unless-stopped
    ports:
      - "8080:8080"
    volumes:
      - ./data:/data
    environment:
      - QL_USER=admin
      - QL_PASS_HASH=$2a$12... # generate with bcrypt
      - QL_ROOT=/data
      - QL_COOKIE_SECRET=super_secret_session_key
      - QL_MAX_UPLOAD=2147483648
```

## Setup for Development

Prerequisites:
- [Go 1.22+](https://go.dev/)
- [Node.js](https://nodejs.org/) (for Tailwind CSS CLI)

```bash
# Get dependencies
go mod tidy

## 🚀 Deployment

### Docker (Recommended)
1. Copy `.env.example` to `.env` and fill in your configuration.
2. Run `docker-compose up -d`.
3. Access Nodi at `http://localhost:8080`.

### Manual Build
1. Build CSS: `./tailwindcss-linux-x64 -i ./web/static/input.css -o ./web/static/output.css --minify`
2. Build Go: `go build -o nodi ./cmd/server`
3. Run: `./nodi`
```
