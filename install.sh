#!/usr/bin/env bash

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m'

APP_NAME="${APP_NAME:-nodi}"
INSTALL_DIR="${INSTALL_DIR:-nodi-app}"
IMAGE="${NODI_IMAGE:-ghcr.io/twarga/nodi:latest}"
PORT="${NODI_PORT:-7319}"
USER_NAME="${NODI_USER:-admin}"
PASSWORD_HASH="${NODI_PASS_HASH:-\$2b\$10\$giD/vH5ZWt26q8GEN0PdZejq/ZdpxdMci5bK4U2fnLHj1mfqZXmCy}"
MAX_UPLOAD="${NODI_MAX_UPLOAD:-2147483648}"
DRY_RUN=false

log() {
  printf "%b==>%b %s\n" "$BLUE" "$NC" "$1"
}

success() {
  printf "%b==>%b %s\n" "$GREEN" "$NC" "$1"
}

warn() {
  printf "%bWarning:%b %s\n" "$YELLOW" "$NC" "$1"
}

fail() {
  printf "%bError:%b %s\n" "$RED" "$NC" "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 is not installed."
}

compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    echo "docker compose"
    return
  fi
  if command -v docker-compose >/dev/null 2>&1; then
    echo "docker-compose"
    return
  fi
  fail "Docker Compose is not installed. Install the Docker Compose plugin or docker-compose."
}

random_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 48 | tr -d '\n'
    return
  fi
  dd if=/dev/urandom bs=48 count=1 2>/dev/null | base64 | tr -d '\n'
}

usage() {
  cat <<EOF
Usage: $0 [OPTIONS]

Install Nodi file manager via Docker Compose.

Options:
  -d, --dir DIR       Installation directory (default: ./nodi-app)
  -p, --port PORT     Host port to expose (default: 7319)
  -i, --image IMAGE   Docker image to use (default: ghcr.io/twarga/nodi:latest)
  -u, --user USER     Admin username (default: admin)
      --dry-run       Show what would be done without executing
      --uninstall     Remove Nodi installation
      --update        Pull latest image and restart
  -h, --help          Show this help message

Environment Variables:
  NODI_IMAGE          Docker image
  NODI_PORT           Host port
  NODI_USER           Admin username
  NODI_PASS_HASH      Bcrypt password hash
  NODI_COOKIE_SECRET  Session cookie secret
  NODI_MAX_UPLOAD     Max upload size in bytes
EOF
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    -d|--dir) INSTALL_DIR="$2"; shift 2 ;;
    -p|--port) PORT="$2"; shift 2 ;;
    -i|--image) IMAGE="$2"; shift 2 ;;
    -u|--user) USER_NAME="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    --uninstall) ACTION="uninstall"; shift ;;
    --update) ACTION="update"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) fail "Unknown option: $1. Use --help for usage." ;;
  esac
done

require_command docker
COMPOSE="$(compose_cmd)"

# Verify Docker daemon is running
if ! docker info >/dev/null 2>&1; then
  fail "Docker daemon is not running. Start Docker and try again."
fi

# Uninstall action
if [[ "${ACTION:-}" == "uninstall" ]]; then
  if [ ! -d "$INSTALL_DIR" ]; then
    fail "Installation directory not found: $INSTALL_DIR"
  fi
  log "Removing Nodi installation from $INSTALL_DIR"
  cd "$INSTALL_DIR"
  $COMPOSE down -v --remove-orphans 2>/dev/null || true
  cd ..
  rm -rf "$INSTALL_DIR"
  success "Nodi has been uninstalled."
  exit 0
fi

# Update action
if [[ "${ACTION:-}" == "update" ]]; then
  if [ ! -d "$INSTALL_DIR" ]; then
    fail "Installation directory not found: $INSTALL_DIR"
  fi
  log "Updating Nodi in $INSTALL_DIR"
  cd "$INSTALL_DIR"
  $COMPOSE pull
  $COMPOSE up -d
  success "Nodi updated to ${IMAGE}"
  exit 0
fi

# Install action
log "Installing Nodi file manager into ./${INSTALL_DIR}"
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

COOKIE_SECRET="${NODI_COOKIE_SECRET:-$(random_secret)}"

cat > nodi.env <<EOF
QL_PORT=7319
QL_ROOT=/data
QL_USER=${USER_NAME}
QL_PASS_HASH=${PASSWORD_HASH}
QL_COOKIE_SECRET=${COOKIE_SECRET}
QL_THEME=${NODI_THEME:-system}
QL_MAX_UPLOAD=${MAX_UPLOAD}
EOF

cat > docker-compose.yml <<EOF
services:
  ${APP_NAME}:
    image: ${IMAGE}
    container_name: ${APP_NAME}
    restart: unless-stopped
    ports:
      - "${PORT}:7319"
    env_file:
      - path: nodi.env
        format: raw
    volumes:
      - nodi-data:/data
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://127.0.0.1:7319/login"]
      interval: 30s
      timeout: 5s
      retries: 5
      start_period: 15s
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    read_only: true
    tmpfs:
      - /tmp

volumes:
  nodi-data:
EOF

if [ "$DRY_RUN" = true ]; then
  log "Dry run mode — showing configuration:"
  echo ""
  echo "  Install dir:  $(pwd)"
  echo "  Image:        ${IMAGE}"
  echo "  Port:         ${PORT}"
  echo "  User:         ${USER_NAME}"
  echo ""
  echo "  nodi.env:"
  cat nodi.env | sed 's/^/    /'
  echo ""
  echo "  docker-compose.yml:"
  cat docker-compose.yml | sed 's/^/    /'
  exit 0
fi

log "Pulling ${IMAGE}"
if ! $COMPOSE pull; then
  fail "Could not pull ${IMAGE}. Confirm the GitHub Actions Docker publish workflow has completed successfully."
fi

log "Starting Nodi"
$COMPOSE up -d

# Wait for health check
log "Waiting for Nodi to become healthy..."
for i in {1..30}; do
  if $COMPOSE ps | grep -q "healthy"; then
    break
  fi
  sleep 1
done

INSTALL_PATH="$(pwd)"
success "Nodi is running at http://localhost:${PORT}"
warn "Default password is 'admin' — change it immediately after first login."
printf "Configuration directory: %s\n" "$INSTALL_PATH"
printf "Useful commands:\n"
printf "  cd %s && %s ps\n" "$INSTALL_PATH" "$COMPOSE"
printf "  cd %s && %s logs -f\n" "$INSTALL_PATH" "$COMPOSE"
printf "  cd %s && %s down       # Stop Nodi\n" "$INSTALL_PATH" "$COMPOSE"
printf "  cd %s && %s --update   # Update to latest image\n" "$INSTALL_PATH" "$0"