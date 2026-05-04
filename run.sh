#!/usr/bin/env bash
set -euo pipefail

# Nodi — run the full app locally (development mode)
# Usage: ./run.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Default configuration
DEFAULT_HOST="0.0.0.0"
DEFAULT_PORT="7319"
DEFAULT_PASS_HASH='$2b$10$giD/vH5ZWt26q8GEN0PdZejq/ZdpxdMci5bK4U2fnLHj1mfqZXmCy'

# ─── Helpers ────────────────────────────────────────────────────

check_cmd() {
  if ! command -v "$1" &>/dev/null; then
    echo -e "${RED}Error: $1 is required but not installed.${NC}"
    echo "       Install it and try again."
    exit 1
  fi
}

step() {
  echo -e "${BLUE}==>${NC} $1"
}

ok() {
  echo -e "${GREEN}   ✓${NC} $1"
}

warn() {
  echo -e "${YELLOW}   !${NC} $1"
}

# ─── Dependency Check ───────────────────────────────────────────

step "Checking dependencies"
check_cmd go
check_cmd node
check_cmd npm
ok "Go $(go version | awk '{print $3}')"
ok "Node $(node --version)"
ok "npm $(npm --version)"

# ─── Frontend Build ─────────────────────────────────────────────

step "Building frontend"
cd web/app
if [ ! -d "node_modules" ]; then
  npm ci --no-audit --no-fund
fi
npm run build
ok "Frontend built"
cd "$SCRIPT_DIR"

# ─── Environment Setup ──────────────────────────────────────────

step "Checking environment"
if [ ! -f ".env" ]; then
  warn ".env not found — creating default"
  cat > .env <<EOF
QL_HOST=$DEFAULT_HOST
QL_PORT=$DEFAULT_PORT
QL_ROOT=./nodi_files
QL_USER=admin
QL_PASS_HASH=$DEFAULT_PASS_HASH
QL_COOKIE_SECRET=local-development-secret-keep-it-safe-123
QL_THEME=system
EOF
  ok "Created .env with default values"
  warn "Default credentials: admin / admin"
  warn "Change QL_PASS_HASH and QL_COOKIE_SECRET before production use"
fi

# Export variables from .env safely (skip comments, don't expand $ in values)
while IFS='=' read -r key val; do
  [ -z "$key" ] && continue
  [[ "$key" =~ ^[[:space:]]*# ]] && continue
  key=$(echo "$key" | xargs) # trim whitespace
  val=$(echo "$val" | xargs) # trim whitespace
  [ -z "$key" ] && continue
  export "$key=$val"
done < .env

mkdir -p nodi_files
ok "Storage directory ready: ./nodi_files"

# ─── Start Server ───────────────────────────────────────────────

step "Starting Nodi server"
echo ""
echo -e "   ${GREEN}Local:${NC}   http://localhost:${DEFAULT_PORT}"
NETWORK_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || ip route get 1 2>/dev/null | awk '{print $7; exit}' || echo "")
if [ -n "$NETWORK_IP" ]; then
  echo -e "   ${GREEN}Network:${NC} http://${NETWORK_IP}:${DEFAULT_PORT}"
fi
echo ""

go run ./cmd/server
