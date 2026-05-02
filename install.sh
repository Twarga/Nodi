#!/usr/bin/env bash

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

APP_NAME="${APP_NAME:-nodi}"
INSTALL_DIR="${INSTALL_DIR:-nodi-app}"
IMAGE="${NODI_IMAGE:-ghcr.io/twarga/nodi:latest}"
PORT="${NODI_PORT:-8080}"
USER_NAME="${NODI_USER:-admin}"
PASSWORD_HASH="${NODI_PASS_HASH:-\$2b\$10\$giD/vH5ZWt26q8GEN0PdZejq/ZdpxdMci5bK4U2fnLHj1mfqZXmCy}"
MAX_UPLOAD="${NODI_MAX_UPLOAD:-2147483648}"

log() {
  printf "%b==>%b %s\n" "$BLUE" "$NC" "$1"
}

success() {
  printf "%b==>%b %s\n" "$GREEN" "$NC" "$1"
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

require_command docker
COMPOSE="$(compose_cmd)"

log "Installing Nodi file manager into ./${INSTALL_DIR}"
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

COOKIE_SECRET="${NODI_COOKIE_SECRET:-$(random_secret)}"

cat > nodi.env <<EOF
QL_PORT=8080
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
      - "${PORT}:8080"
    env_file:
      - path: nodi.env
        format: raw
    volumes:
      - nodi-data:/data
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://127.0.0.1:8080/login"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 10s
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

log "Pulling ${IMAGE}"
if ! $COMPOSE pull; then
  fail "Could not pull ${IMAGE}. Confirm the GitHub Actions Docker publish workflow has completed successfully."
fi

log "Starting Nodi"
$COMPOSE up -d

INSTALL_PATH="$(pwd)"
success "Nodi is running at http://localhost:${PORT}"
printf "Default credentials: %s / admin\n" "$USER_NAME"
printf "Configuration directory: %s\n" "$INSTALL_PATH"
printf "Useful commands:\n"
printf "  cd %s && %s ps\n" "$INSTALL_PATH" "$COMPOSE"
printf "  cd %s && %s logs -f\n" "$INSTALL_PATH" "$COMPOSE"
