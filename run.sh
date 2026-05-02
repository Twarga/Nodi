#!/bin/bash

# Nodi - Local Development Runner
# Automates Tailwind CSS compilation and Go server startup

set -e

# 1. Ensure Tailwind CSS binary exists
TAILWIND_BIN="./tailwindcss-linux-x64"
if [ ! -f "$TAILWIND_BIN" ]; then
    echo "==> Downloading Tailwind CSS standalone CLI..."
    curl -sLO https://github.com/tailwindlabs/tailwindcss/releases/download/v3.4.1/tailwindcss-linux-x64
    chmod +x tailwindcss-linux-x64
fi

# 2. Compile CSS
echo "==> Compiling CSS..."
$TAILWIND_BIN -i ./web/static/input.css -o ./web/static/output.css --minify

# 3. Setup default environment if .env is missing
if [ ! -f ".env" ]; then
    echo "==> .env not found. Creating a default test configuration..."
    # We use some safe defaults for local testing
    cat > .env <<EOF
QL_PORT=8080
QL_ROOT=./data
QL_USER=admin
# Hash for 'admin'
QL_PASS_HASH=\$2b\$10\$giD/vH5ZWt26q8GEN0PdZejq/ZdpxdMci5bK4U2fnLHj1mfqZXmCy
QL_COOKIE_SECRET=local-development-secret-keep-it-safe-123
QL_THEME=system
EOF
    mkdir -p data
fi

# 4. Source .env for the current shell session (optional, but helps with go run)
export $(grep -v '^#' .env | xargs)

# 5. Run the server
echo "==> Starting Nodi Server..."
go run cmd/server/main.go
