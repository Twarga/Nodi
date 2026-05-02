<p align="center">
  <img src="./logo.png" alt="Nodi logo" width="180" />
</p>

<p align="center"># Nodi

**Nodi** is a lightweight, self-hosted web file manager built for speed and simplicity. It provides a polished, asynchronous interface for managing your files via Docker or as a standalone binary.

![Nodi Dashboard](/logo.png)

## ✨ Features

- **Quiet Technical UI**: Dense, editorial-inspired monastic design.
- **Async Workflow**: SPA-like navigation and operations (Create, Rename, Delete) with real-time feedback.
- **Secure Uploads**: Granular progress tracking and atomic staging for large file uploads.
- **Fast Search**: Instant directory browsing and breadcrumb-based navigation.
- **Theme Aware**: First-class support for Light, Dark, and System modes.
- **Tiny Footprint**: Multi-stage Docker build resulting in a minimal runtime image (~20MB).

## 🚀 Fast Install

Run the following command to set up Nodi on your server instantly:

```bash
curl -fsSL https://raw.githubusercontent.com/Twarga/Nodi/main/install.sh | bash
```

## 🛠️ Configuration

Nodi is configured via environment variables. Copy `.env.example` to `.env` to customize your installation.

| Variable | Description | Default |
| :--- | :--- | :--- |
| `QL_PORT` | Port to listen on | `8080` |
| `QL_USER` | Admin username | `admin` |
| `QL_PASS_HASH` | BCrypt hash of the admin password | (Required) |
| `QL_ROOT` | Root directory for file storage | `/data` |
| `QL_COOKIE_SECRET` | 32+ character string for session signing | (Required) |
| `QL_THEME` | Default UI theme (`light`, `dark`, `system`) | `system` |

## 🏗️ Development

### Local Build
1. **Frontend**: Compile Tailwind CSS
   ```bash
   ./tailwindcss-linux-x64 -i ./web/static/input.css -o ./web/static/output.css --minify
   ```
2. **Backend**: Build the Go binary
   ```bash
   go build -o nodi ./cmd/server
   ```
3. **Run**:
   ```bash
   ./nodi
   ```

### Docker
```bash
docker-compose up --build
```

## 📄 License
MIT License. Created by [Twarga](https://github.com/Twarga).
