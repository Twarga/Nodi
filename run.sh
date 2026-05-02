#!/usr/bin/env bash

# Nodi - Local Development Runner
# Automates Tailwind CSS compilation and Go server startup

set -euo pipefail

DEFAULT_PORT=7319
DEFAULT_PASS_HASH='$2b$10$giD/vH5ZWt26q8GEN0PdZejq/ZdpxdMci5bK4U2fnLHj1mfqZXmCy'
OLD_INVALID_PASS_HASH='$2y$10$y58t9Y6PqBf9N6qA58t9Ye8Zp6iS6Y7YmS6i6Y7YmS6i6Y7YmS6i6'

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
QL_PORT=$DEFAULT_PORT
QL_ROOT=./data
QL_USER=admin
# Hash for 'admin'
QL_PASS_HASH=$DEFAULT_PASS_HASH
QL_COOKIE_SECRET=local-development-secret-keep-it-safe-123
QL_THEME=system
EOF
    mkdir -p data
fi

# 3b. Migrate older local defaults that made development confusing.
if grep -q '^QL_PORT=8080$' .env; then
    echo "==> Updating local .env port from 8080 to $DEFAULT_PORT..."
    sed -i.bak "s/^QL_PORT=8080$/QL_PORT=$DEFAULT_PORT/" .env
fi

if grep -Fqx "QL_PASS_HASH=$OLD_INVALID_PASS_HASH" .env; then
    echo "==> Replacing invalid local admin password hash..."
    sed -i.bak "s|^QL_PASS_HASH=.*$|QL_PASS_HASH=$DEFAULT_PASS_HASH|" .env
fi

# 4. Load .env literally so bcrypt hashes containing '$' are not shell-expanded.
while IFS='=' read -r key value; do
    case "$key" in
        ''|\#*) continue ;;
    esac
    export "$key=$value"
done < .env

# 5. Run the server
echo "==> Starting Nodi Server..."
go run cmd/server/main.go
