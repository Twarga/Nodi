#!/usr/bin/env bash
set -euo pipefail

# Nodi — run the full app locally (development mode)
#
# Usage:
#   ./run.sh                  build frontend (if needed), start the Go server
#   ./run.sh --no-build       skip the frontend build
#   ./run.sh --reset          wipe ./nodi_files and ./.env for a clean start
#   ./run.sh --test           run Go test suite + frontend build, no server start
#   ./run.sh --port 8080      override the listen port
#   ./run.sh --bg             start in background, write logs to ./nodi.log,
#                             and print a stop command
#   ./run.sh --stop           kill any backgrounded Nodi process

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ─── Colors ──────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ─── Defaults ────────────────────────────────────────────────────
DEFAULT_HOST="0.0.0.0"
DEFAULT_PORT="7319"
DEFAULT_PASS_HASH='$2b$10$giD/vH5ZWt26q8GEN0PdZejq/ZdpxdMci5bK4U2fnLHj1mfqZXmCy'
PID_FILE="$SCRIPT_DIR/.nodi.pid"
LOG_FILE="$SCRIPT_DIR/nodi.log"

DO_BUILD=1
DO_RESET=0
DO_TEST=0
DO_BG=0
DO_STOP=0
PORT="$DEFAULT_PORT"

# ─── Args ────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-build) DO_BUILD=0 ;;
    --reset)    DO_RESET=1 ;;
    --test)     DO_TEST=1 ;;
    --bg)       DO_BG=1 ;;
    --stop)     DO_STOP=1 ;;
    --port)     PORT="${2:-}"; shift ;;
    -h|--help)
      sed -n '3,16p' "$0"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown flag: $1${NC}"; exit 1 ;;
  esac
  shift
done

# ─── Helpers ─────────────────────────────────────────────────────

generate_secret() {
  if command -v openssl &>/dev/null; then
    openssl rand -base64 48 | tr -d '\n'
    return
  fi
  dd if=/dev/urandom bs=48 count=1 2>/dev/null | base64 | tr -d '\n'
}

check_cmd() {
  if ! command -v "$1" &>/dev/null; then
    echo -e "${RED}Error: $1 is required but not installed.${NC}"
    echo "       Install it and try again."
    exit 1
  fi
}

step() { echo -e "${BLUE}==>${NC} $1"; }
ok()   { echo -e "${GREEN}   ✓${NC} $1"; }
warn() { echo -e "${YELLOW}   !${NC} $1"; }

stop_bg() {
  local killed=0
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      sleep 0.3
      kill -9 "$pid" 2>/dev/null || true
      killed=1
      ok "Stopped background Nodi wrapper (pid $pid)"
    fi
    rm -f "$PID_FILE"
  fi
  # Kill the actual compiled server binary that `go run` spawned. The binary
  # lives under $GOCACHE (default ~/.cache/go-build) and is named just
  # `server`, so we match on either the path or the basename. We also look
  # under any GOCACHE override (e.g. /tmp/nodi-gocache) used by --test.
  pkill -f "go-build.*cmd/server" 2>/dev/null && killed=1 || true
  pkill -f "go-build.*/server" 2>/dev/null && killed=1 || true
  pkill -x "server" 2>/dev/null && killed=1 || true
  # Last resort: kill the listening process on the port. Works even when
  # the binary was renamed, when GOCACHE is non-default, or when no pid
  # file is around.
  local port_pid
  port_pid="$(ss -tlnp 2>/dev/null | awk '{print $0}' | grep ":$PORT " | grep -oE 'pid=[0-9]+' | head -1 | cut -d= -f2 || true)"
  if [[ -z "$port_pid" ]]; then
    port_pid="$(ss -tlnp 2>/dev/null | awk '{print $0}' | grep ":$DEFAULT_PORT " | grep -oE 'pid=[0-9]+' | head -1 | cut -d= -f2 || true)"
  fi
  if [[ -n "$port_pid" ]] && kill -0 "$port_pid" 2>/dev/null; then
    kill "$port_pid" 2>/dev/null || true
    sleep 0.3
    kill -9 "$port_pid" 2>/dev/null || true
    killed=1
    ok "Stopped Nodi listening on port $PORT (pid $port_pid)"
  fi
  if [[ $killed -eq 0 ]]; then
    ok "No background Nodi process found"
  fi
  exit 0
}

# ─── --stop ──────────────────────────────────────────────────────
if [[ $DO_STOP -eq 1 ]]; then
  stop_bg
fi

# ─── --reset ─────────────────────────────────────────────────────
if [[ $DO_RESET -eq 1 ]]; then
  step "Resetting local state"
  rm -rf nodi_files
  rm -f .env
  ok "Removed ./nodi_files and ./.env"
fi

# ─── --test ──────────────────────────────────────────────────────
if [[ $DO_TEST -eq 1 ]]; then
  step "Running Go test suite"
  GOCACHE=/tmp/nodi-gocache go test ./...
  ok "Go tests passed"
  if [[ $DO_BUILD -eq 1 ]]; then
    step "Building frontend"
    (cd web/app && [[ ! -d node_modules ]] && npm ci --no-audit --no-fund; npm run build)
    ok "Frontend built"
  fi
  echo ""
  ok "All checks green"
  exit 0
fi

# ─── Dependency Check ───────────────────────────────────────────

step "Checking dependencies"
check_cmd go
check_cmd node
check_cmd npm
ok "Go $(go version | awk '{print $3}')"
ok "Node $(node --version)"
ok "npm $(npm --version)"

# ─── Frontend Build ─────────────────────────────────────────────

if [[ $DO_BUILD -eq 1 ]]; then
  step "Building frontend"
  cd web/app
  if [[ ! -d node_modules ]]; then
    npm ci --no-audit --no-fund
  fi
  npm run build
  ok "Frontend built"
  cd "$SCRIPT_DIR"
else
  step "Skipping frontend build (--no-build)"
fi

# ─── Environment Setup ──────────────────────────────────────────

step "Checking environment"
if [[ ! -f .env ]]; then
  warn ".env not found — creating default"
  COOKIE_SECRET="$(generate_secret)"
  cat > .env <<EOF
QL_HOST=$DEFAULT_HOST
QL_PORT=$PORT
QL_ROOT=./nodi_files
QL_USER=admin
QL_PASS_HASH=$DEFAULT_PASS_HASH
QL_COOKIE_SECRET=$COOKIE_SECRET
QL_THEME=system
QL_MAX_UPLOAD=1099511627776
QL_MAX_CHUNK_SIZE=16777216
QL_UPLOAD_TTL=48h
QL_TRASH_RETENTION=720h
GOTMPDIR=./nodi_files/.cache/tmp
EOF
  ok "Created .env with default values"
  warn "Default credentials: admin / admin"
  warn "Change QL_PASS_HASH before production use"
else
  # Keep the port in .env in sync with --port if it was overridden.
  if [[ "$PORT" != "$DEFAULT_PORT" ]]; then
    sed -i.bak -E "s|^QL_PORT=.*|QL_PORT=$PORT|" .env
    rm -f .env.bak
    ok "Updated QL_PORT in .env to $PORT"
  fi
fi

if grep -Eq '^QL_COOKIE_SECRET=(local-development-secret-keep-it-safe-123|change-this-to-a-random-string-at-least-32-bytes-long|change-me|changeme|secret|password)$' .env; then
  warn "Unsafe QL_COOKIE_SECRET found — replacing with a random value"
  COOKIE_SECRET="$(generate_secret)"
  tmp_env="$(mktemp)"
  awk -v secret="$COOKIE_SECRET" 'BEGIN{done=0} /^QL_COOKIE_SECRET=/{print "QL_COOKIE_SECRET=" secret; done=1; next} {print} END{if(!done) print "QL_COOKIE_SECRET=" secret}' .env > "$tmp_env"
  mv "$tmp_env" .env
  ok "Cookie secret rotated"
fi

# Export variables from .env safely (skip comments, don't expand $ in values)
while IFS='=' read -r key val; do
  [[ -z "$key" ]] && continue
  [[ "$key" =~ ^[[:space:]]*# ]] && continue
  key=$(echo "$key" | xargs)
  val=$(echo "$val" | xargs)
  [[ -z "$key" ]] && continue
  export "$key=$val"
done < .env

mkdir -p nodi_files
mkdir -p nodi_files/.cache/tmp
ok "Storage directory ready: ./nodi_files"

# ─── Start Server ───────────────────────────────────────────────

step "Starting Nodi server"
echo ""
echo -e "   ${GREEN}Local:${NC}   http://localhost:${PORT}"
NETWORK_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || ip route get 1 2>/dev/null | awk '{print $7; exit}' || echo "")
if [[ -n "$NETWORK_IP" ]]; then
  echo -e "   ${GREEN}Network:${NC} http://${NETWORK_IP}:${PORT}"
fi
echo -e "   ${GREEN}Login:${NC}   admin / admin"
echo ""

if [[ $DO_BG -eq 1 ]]; then
  nohup go run ./cmd/server > "$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"
  ok "Nodi started in background (pid $(cat "$PID_FILE"))"
  echo ""
  echo -e "   ${YELLOW}Logs:${NC}  tail -f $LOG_FILE"
  echo -e "   ${YELLOW}Stop:${NC}  $0 --stop"
  exit 0
fi

exec go run ./cmd/server
