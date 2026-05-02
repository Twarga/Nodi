<div align="center">
  <img src="logo.png" alt="Node Logo" width="200" />
  <h1>Node</h1>
  <p><b>Lightweight, self-hosted web file manager for homelabs and personal cloud replacement.</b></p>
</div>

---

Node is a **minimalist, self-hosted web file manager** designed to run on low-resource hardware with zero dependencies beyond a single binary and a Docker container.

## Features

- **No bloated sync clients**: Pure web UI, accessible anywhere.
- **Fast and lightweight**: Single Go binary backend, Vanilla JS and Tailwind CSS frontend.
- **High performance**: Designed to run natively on Alpine Linux with minimal memory footprints.
- **Privacy focused**: Local filesystem is the single source of truth. No indexing, no database telemetry.
- **Modern Design**: High contrast typography, flat aesthetics, inspired by the best terminal tools. Dark/Light mode supported natively.

## Quick Start (Docker)

```yaml
services:
  node:
    image: node/node:latest
    ports:
      - "8080:8080"
    volumes:
      - ./data:/data
    environment:
      - QL_USER=admin
      - QL_PASS_HASH=$2a$12... # generate with bcrypt
      - QL_ROOT=/data
      - QL_COOKIE_SECRET=super_secret_session_key 
```

## Setup for Development

Prerequisites: Go 1.22+, Tailwind CSS CLI

```bash
# Get dependencies
go mod tidy

# Watch CSS
npx tailwindcss -i ./web/static/input.css -o ./web/static/output.css --watch

# Start server
go run ./cmd/server
```

## Security & Architecture

Node follows strict sandboxing protocols:
- **Path Traversal Guards**: Every request path is fully evaluated against the root jail.
- **Zero Configuration DB**: No SQL injection or complex permission structures.
- **Direct Syscalls**: Uses OS level controls to handle limits.
- **Stream Uploads**: Memory capping per connection limits RAM usage regardless of incoming file size.

---

*Open Source under MIT License.*
