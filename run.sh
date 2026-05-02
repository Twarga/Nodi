#!/usr/bin/env bash

# Nodi - Local Development Runner
# Automates Tailwind CSS compilation and Go server startup

set -euo pipefail

DEFAULT_PORT=7319
DEFAULT_PASS_HASH='$2b$10$giD/vH5ZWt26q8GEN0PdZejq/ZdpxdMci5bK4U2fnLHj1mfqZXmCy'
OLD_INVALID_PASS_HASH='$2y$10$y58t9Y6PqBf9N6qA58t9Ye8Zp6iS6Y7YmS6i6Y7YmS6i6Y7YmS6i6'

# Detect platform
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)
case "$ARCH" in
    x86_64) ARCH="x64" ;;
    arm64|aarch64) ARCH="arm64" ;;
    *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

TAILWIND_VERSION="3.4.17"
TAILWIND_BIN="./tailwindcss-${OS}-${ARCH}"

usage() {
    cat <<EOF
Usage: $0 [OPTIONS]

Run Nodi in local development mode.

Options:
  -w, --watch    Watch for CSS changes and auto-recompile
  -h, --help     Show this help message

Examples:
  $0             # Start server once
  $0 --watch     # Start server with CSS hot-reload
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

# 1. Ensure Tailwind CSS binary exists
if [ ! -f "$TAILWIND_BIN" ]; then
    echo "==> Downloading Tailwind CSS ${TAILWIND_VERSION} for ${OS}-${ARCH}..."
    curl -sLO "https://github.com/tailwindlabs/tailwindcss/releases/download/v${TAILWIND_VERSION}/tailwindcss-${OS}-${ARCH}"
    chmod +x "tailwindcss-${OS}-${ARCH}"
    # Verify it's a valid binary
    if ! "$TAILWIND_BIN" --help >/dev/null 2>&1; then
        echo "ERROR: Downloaded Tailwind binary is not executable. Removing."
        rm -f "$TAILWIND_BIN"
        exit 1
    fi
fi

# 2. Compile CSS
if [ "$WATCH_MODE" = true ]; then
    echo "==> Compiling CSS (watch mode)..."
    $TAILWIND_BIN -i ./web/static/input.css -o ./web/static/output.css --minify --watch &
    TAILWIND_PID=$!
    trap 'kill $TAILWIND_PID 2>/dev/null || true' EXIT
else
    echo "==> Compiling CSS..."
    $TAILWIND_BIN -i ./web/static/input.css -o ./web/static/output.css --minify
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
go run cmd/server/main.go