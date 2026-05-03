#!/usr/bin/env bash

# Nodi - Local Development Runner
# Automates frontend build and Go server startup

set -euo pipefail

DEFAULT_PORT=7319
DEFAULT_PASS_HASH='$2b$10$giD/vH5ZWt26q8GEN0PdZejq/ZdpxdMci5bK4U2fnLHj1mfqZXmCy'
OLD_INVALID_PASS_HASH='$2y$10$y58t9Y6PqBf9N6qA58t9Ye8Zp6iS6Y7YmS6i6Y7YmS6i6Y7YmS6i6'

usage() {
    cat <<EOF
Usage: $0 [OPTIONS]

Run Nodi in local development mode.

Options:
  -w, --watch    Start Vite dev server with hot-reload
  -h, --help     Show this help message

Examples:
  $0             # Build frontend and start server
  $0 --watch     # Start Vite dev server + Go backend
EOF
}

WATCH_MODE=false
while [[ $# -gt 0 ]]; do
    case "$1" in
        -w|--watch) WATCH_MODE=true; shift ;;
        -h|--help) usage; exit 0 ;;
        *) echo "Unknown option: $1"; usage; exit 1 ;;
    esac
done

# 1. Ensure node_modules exists
if [ ! -d "web/app/node_modules" ]; then
    echo "==> Installing frontend dependencies..."
    (cd web/app && npm ci)
fi

# 2. Build frontend
if [ "$WATCH_MODE" = true ]; then
    echo "==> Starting Vite dev server (watch mode)..."
    (cd web/app && npm run dev &)
    VITE_PID=$!
    trap 'kill $VITE_PID 2>/dev/null || true' EXIT
else
    echo "==> Building frontend..."
    (cd web/app && npm run build)
fi

# 3. Setup default environment if .env is missing
if [ ! -f ".env" ]; then
    echo "==> .env not found. Creating a default test configuration..."
    cat > .env <<EOF
QL_PORT=$DEFAULT_PORT
QL_ROOT=./data
QL_USER=admin
QL_PASS_HASH=$DEFAULT_PASS_HASH
QL_COOKIE_SECRET=local-development-secret-keep-it-safe-123
EOF
    mkdir -p data
fi

# 3b. Migrate older local defaults
if grep -q '^QL_PORT=8080$' .env; then
    echo "==> Updating local .env port from 8080 to $DEFAULT_PORT..."
    sed -i.bak "s/^QL_PORT=8080$/QL_PORT=$DEFAULT_PORT/" .env
fi

if grep -Fqx "QL_PASS_HASH=$OLD_INVALID_PASS_HASH" .env; then
    echo "==> Replacing invalid local admin password hash..."
    sed -i.bak "s|^QL_PASS_HASH=.*$|QL_PASS_HASH=$DEFAULT_PASS_HASH|" .env
fi

# 4. Load .env literally so bcrypt hashes containing '$' are not shell-expanded
while IFS='=' read -r key value; do
    case "$key" in
        ''|\#*) continue ;;
    esac
    export "$key=$value"
done < .env

# 5. Run the server
echo "==> Starting Nodi Server..."
if [ "$WATCH_MODE" = true ]; then
    echo "    Frontend: http://localhost:5173"
    echo "    Backend:  http://localhost:$DEFAULT_PORT"
fi
go run cmd/server/main.go
