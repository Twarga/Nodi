#!/usr/bin/env bash
set -euo pipefail

# Nodi Installer — builds fresh from source every time
# Usage: curl -fsSL https://raw.githubusercontent.com/Twarga/Nodi/main/install.sh | bash

REPO="https://github.com/Twarga/Nodi.git"
INSTALL_DIR="${INSTALL_DIR:-nodi-app}"
PORT="${NODI_PORT:-7319}"
HOST="${NODI_HOST:-0.0.0.0}"
USER_NAME="${NODI_USER:-admin}"
PASS_HASH="${NODI_PASS_HASH:-\$2b\$10\$giD/vH5ZWt26q8GEN0PdZejq/ZdpxdMci5bK4U2fnLHj1mfqZXmCy}"
MAX_UPLOAD="${NODI_MAX_UPLOAD:-2147483648}"

BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

step() { printf "  ${GREEN}✓${NC}  %s\n" "$1"; }
info() { printf "  ${CYAN}→${NC}  %s\n" "$1"; }
warn() { printf "  ${YELLOW}!${NC}  %s\n" "$1"; }
fail() { printf "  ${RED}✗${NC}  %s\n" "$1" >&2; exit 1; }

# ─── Check Docker ───────────────────────────────────────────────

if ! command -v docker >/dev/null 2>&1; then
    fail "Docker is not installed. Install Docker first: https://docs.docker.com/engine/install/"
fi

if ! docker info >/dev/null 2>&1; then
    fail "Docker daemon is not running. Start Docker and try again."
fi

COMPOSE="docker compose"
if ! $COMPOSE version >/dev/null 2>&1; then
    if command -v docker-compose >/dev/null 2>&1; then
        COMPOSE="docker-compose"
    else
        fail "Docker Compose is not installed."
    fi
fi

# ─── Uninstall old version ──────────────────────────────────────

if [ -d "$INSTALL_DIR" ]; then
    info "Removing old installation at ./$INSTALL_DIR"
    (cd "$INSTALL_DIR" && $COMPOSE down -v --remove-orphans 2>/dev/null || true) >/dev/null 2>&1
    rm -rf "$INSTALL_DIR"
    step "Old installation removed"
fi

# ─── Clone fresh source ─────────────────────────────────────────

info "Cloning latest source code"
if ! git clone --depth 1 "$REPO" "$INSTALL_DIR" >/dev/null 2>&1; then
    fail "Failed to clone repository. Check internet connection."
fi
step "Source cloned"

# ─── Write config ───────────────────────────────────────────────

COOKIE_SECRET=""
if command -v openssl >/dev/null 2>&1; then
    COOKIE_SECRET=$(openssl rand -base64 48 | tr -d '\n')
else
    COOKIE_SECRET=$(dd if=/dev/urandom bs=48 count=1 2>/dev/null | base64 | tr -d '\n')
fi

cat > "$INSTALL_DIR/nodi.env" <<EOF
QL_HOST=$HOST
QL_PORT=7319
QL_ROOT=/nodi_files
QL_USER=$USER_NAME
QL_PASS_HASH=$PASS_HASH
QL_COOKIE_SECRET=$COOKIE_SECRET
QL_THEME=system
QL_MAX_UPLOAD=$MAX_UPLOAD
EOF
step "Configuration written"

# ─── Write docker-compose ───────────────────────────────────────

cat > "$INSTALL_DIR/docker-compose.yml" <<EOF
services:
  nodi:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: nodi
    restart: unless-stopped
    ports:
      - "$PORT:7319"
    env_file:
      - path: nodi.env
        format: raw
    volumes:
      - nodi-files:/nodi_files
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
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 128M
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

volumes:
  nodi-files:
    driver: local
EOF
step "docker-compose.yml written"

# ─── Build and start ────────────────────────────────────────────

info "Building Docker image (this may take a few minutes)"
(cd "$INSTALL_DIR" && $COMPOSE build --no-cache) >/dev/null 2>&1
step "Docker image built"

info "Starting Nodi"
(cd "$INSTALL_DIR" && $COMPOSE up -d) >/dev/null 2>&1
step "Container started"

# ─── Wait for healthy ───────────────────────────────────────────

info "Waiting for Nodi to be ready"
for i in $(seq 1 60); do
    if (cd "$INSTALL_DIR" && $COMPOSE ps 2>/dev/null) | grep -q "healthy"; then
        break
    fi
    if [ $i -eq 60 ]; then
        warn "Nodi is slow to start. Check logs: cd $INSTALL_DIR && $COMPOSE logs -f"
        break
    fi
    sleep 1
done
step "Nodi is ready"

# ─── Show success ───────────────────────────────────────────────

LOCAL_IP=""
if command -v ip >/dev/null 2>&1; then
    LOCAL_IP=$(ip -4 route get 1 2>/dev/null | awk '{print $7; exit}')
elif command -v hostname >/dev/null 2>&1; then
    LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
fi

printf "\n"
printf "  ${GREEN}${BOLD}╔════════════════════════════════════════╗${NC}\n"
printf "  ${GREEN}${BOLD}║${NC}  Nodi is running!                      ${GREEN}${BOLD}║${NC}\n"
printf "  ${GREEN}${BOLD}╠════════════════════════════════════════╣${NC}\n"
printf "  ${GREEN}${BOLD}║${NC}                                        ${GREEN}${BOLD}║${NC}\n"
printf "  ${GREEN}${BOLD}║${NC}  ${CYAN}Local:${NC}    http://localhost:%-12s ${GREEN}${BOLD}║${NC}\n" "$PORT"
if [ -n "$LOCAL_IP" ]; then
    printf "  ${GREEN}${BOLD}║${NC}  ${CYAN}Network:${NC}  http://%-22s ${GREEN}${BOLD}║${NC}\n" "$LOCAL_IP:$PORT"
fi
printf "  ${GREEN}${BOLD}║${NC}                                        ${GREEN}${BOLD}║${NC}\n"
printf "  ${GREEN}${BOLD}║${NC}  ${BOLD}User:${NC}     %-28s ${GREEN}${BOLD}║${NC}\n" "$USER_NAME"
printf "  ${GREEN}${BOLD}║${NC}  ${BOLD}Password:${NC} %-28s ${GREEN}${BOLD}║${NC}\n" "admin"
printf "  ${GREEN}${BOLD}║${NC}                                        ${GREEN}${BOLD}║${NC}\n"
printf "  ${GREEN}${BOLD}╚════════════════════════════════════════╝${NC}\n"
printf "\n"

warn "Change the default password immediately after first login."

printf "  ${BOLD}Useful commands:${NC}\n"
printf "    cd %s && %s logs -f\n" "$INSTALL_DIR" "$COMPOSE"
printf "    cd %s && %s down\n" "$INSTALL_DIR" "$COMPOSE"
printf "    cd %s && %s up -d --build\n" "$INSTALL_DIR" "$COMPOSE"
printf "\n"
