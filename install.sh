#!/usr/bin/env bash

# Nodi Installer — Beautiful, bulletproof, always fresh
# Creates a systemd service so Nodi auto-starts on boot
# Usage: bash <(curl -fsSL https://raw.githubusercontent.com/Twarga/Nodi/main/install.sh)

set -euo pipefail

REPO_URL="https://github.com/Twarga/Nodi.git"
INSTALL_DIR="${INSTALL_DIR:-nodi-app}"
HOST="${NODI_HOST:-0.0.0.0}"
USER_NAME="${NODI_USER:-admin}"
PASS_HASH="${NODI_PASS_HASH:-\$2b\$10\$giD/vH5ZWt26q8GEN0PdZejq/ZdpxdMci5bK4U2fnLHj1mfqZXmCy}"
MAX_UPLOAD="${NODI_MAX_UPLOAD:-2147483648}"

# ─── Colors ─────────────────────────────────────────────────────
BOLD='\033[1m'
DIM='\033[2m'
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
WHITE='\033[1;37m'
NC='\033[0m'
CLEAR='\r\033[K'

# ─── Helpers ────────────────────────────────────────────────────

spinner() {
    local pid=$1 msg="$2"
    local spin='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    local i=0
    local exit_code=0

    while kill -0 "$pid" 2>/dev/null; do
        i=$(( (i+1) % 10 ))
        printf "${CLEAR}  ${CYAN}${spin:$i:1}${NC}  %s" "$msg"
        sleep 0.08
    done

    # Wait for background job, capture exit code safely (set -e safe)
    wait "$pid" || exit_code=$?

    if [ $exit_code -eq 0 ]; then
        printf "${CLEAR}  ${GREEN}✓${NC}  %s\n" "$msg"
    else
        printf "${CLEAR}  ${RED}✗${NC}  %s failed (exit %d)\n" "$msg" "$exit_code"
        return $exit_code
    fi
}

step() { printf "  ${GREEN}✓${NC}  %s\n" "$1"; }
info() { printf "  ${BLUE}→${NC}  %s\n" "$1"; }
warn() { printf "  ${YELLOW}!${NC}  %s\n" "$1"; }
fail() {
    printf "\n  ${RED}${BOLD}✗  ERROR:${NC} %s\n\n" "$1" >&2
    printf "  ${DIM}Need help? Open an issue at:${NC}\n"
    printf "  ${CYAN}https://github.com/Twarga/Nodi/issues${NC}\n\n"
    exit 1
}

banner() {
    printf "\n"
    printf "  ${CYAN}${BOLD}╭──────────────────────────────────────────╮${NC}\n"
    printf "  ${CYAN}${BOLD}│${NC}                                          ${CYAN}${BOLD}│${NC}\n"
    printf "  ${CYAN}${BOLD}│${NC}  ${WHITE}${BOLD}███╗   ██╗ ██████╗ ██████╗ ██╗${NC}           ${CYAN}${BOLD}│${NC}\n"
    printf "  ${CYAN}${BOLD}│${NC}  ${WHITE}${BOLD}████╗  ██║██╔═══██╗██╔══██╗██║${NC}           ${CYAN}${BOLD}│${NC}\n"
    printf "  ${CYAN}${BOLD}│${NC}  ${WHITE}${BOLD}██╔██╗ ██║██║   ██║██║  ██║██║${NC}           ${CYAN}${BOLD}│${NC}\n"
    printf "  ${CYAN}${BOLD}│${NC}  ${WHITE}${BOLD}██║╚██╗██║██║   ██║██║  ██║██║${NC}           ${CYAN}${BOLD}│${NC}\n"
    printf "  ${CYAN}${BOLD}│${NC}  ${WHITE}${BOLD}██║ ╚████║╚██████╔╝██████╔╝██║${NC}           ${CYAN}${BOLD}│${NC}\n"
    printf "  ${CYAN}${BOLD}│${NC}  ${WHITE}${BOLD}╚═╝  ╚═══╝ ╚═════╝ ╚═════╝ ╚═╝${NC}           ${CYAN}${BOLD}│${NC}\n"
    printf "  ${CYAN}${BOLD}│${NC}                                          ${CYAN}${BOLD}│${NC}\n"
    printf "  ${CYAN}${BOLD}│${NC}     ${DIM}Self-hosted file manager${NC}              ${CYAN}${BOLD}│${NC}\n"
    printf "  ${CYAN}${BOLD}│${NC}                                          ${CYAN}${BOLD}│${NC}\n"
    printf "  ${CYAN}${BOLD}╰──────────────────────────────────────────╯${NC}\n"
    printf "\n"
}

# ─── Preflight Checks ───────────────────────────────────────────

preflight() {
    info "Checking requirements..."

    if ! command -v docker >/dev/null 2>&1; then
        fail "Docker is not installed.\n\n  Install it first:\n  ${CYAN}https://docs.docker.com/engine/install/${NC}"
    fi

    if ! docker info >/dev/null 2>&1; then
        fail "Docker daemon is not running. Start Docker and try again."
    fi

    COMPOSE="docker compose"
    if ! $COMPOSE version >/dev/null 2>&1; then
        if command -v docker-compose >/dev/null 2>&1; then
            COMPOSE="docker-compose"
        else
            fail "Docker Compose plugin not found.\n\n  Install it:\n  ${CYAN}https://docs.docker.com/compose/install/${NC}"
        fi
    fi

    if ! command -v git >/dev/null 2>&1; then
        fail "Git is not installed.\n\n  ${CYAN}sudo apt install git${NC}  (Debian/Ubuntu)\n  ${CYAN}sudo yum install git${NC}  (RHEL/CentOS)"
    fi

    step "Docker, Compose, and Git are ready"
}

# ─── Remove Old Installation ────────────────────────────────────

cleanup_old() {
    if [ -d "$INSTALL_DIR" ]; then
        info "Removing old installation..."
        (
            cd "$INSTALL_DIR"
            $COMPOSE down --remove-orphans 2>/dev/null || true
        ) >/dev/null 2>&1
        rm -rf "$INSTALL_DIR"
        step "Old installation cleaned up"
    fi

    if [ -f /etc/systemd/system/nodi.service ]; then
        info "Removing old systemd service..."
        sudo systemctl stop nodi 2>/dev/null || true
        sudo systemctl disable nodi 2>/dev/null || true
        sudo rm -f /etc/systemd/system/nodi.service
        sudo systemctl daemon-reload 2>/dev/null || true
        step "Old systemd service removed"
    fi
}

# ─── Clone ──────────────────────────────────────────────────────

clone_repo() {
    info "Cloning latest source code..."
    (
        git clone --depth 1 "$REPO_URL" "$INSTALL_DIR" >/dev/null 2>&1
    ) &
    spinner $! "Cloning repository"
    step "Latest source cloned"
}

# ─── Write Configs ──────────────────────────────────────────────

write_configs() {
    info "Writing configuration..."

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

    cat > "$INSTALL_DIR/docker-compose.yml" <<EOF
services:
  nodi:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: nodi
    restart: unless-stopped
    ports:
      - "7319:7319"
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

    step "Configuration written"
}

# ─── Build ──────────────────────────────────────────────────────

build_image() {
    info "Building Docker image..."
    info "${DIM}This takes 2–5 minutes on first run. Grab a coffee.${NC}"
    local build_log="$INSTALL_DIR/build.log"
    (
        cd "$INSTALL_DIR"
        $COMPOSE build --no-cache >"$build_log" 2>&1
    ) &
    if ! spinner $! "Building Docker image"; then
        printf "\n"
        warn "Build failed. Showing last 30 lines of build log:\n"
        if [ -f "$build_log" ]; then
            tail -n 30 "$build_log" | sed 's/^/    /'
        fi
        printf "\n"
        fail "Docker build failed. Check the full log: ${CYAN}cat $INSTALL_DIR/build.log${NC}"
    fi
    rm -f "$build_log"
    step "Image built successfully"
}

# ─── Start ──────────────────────────────────────────────────────

start_app() {
    info "Starting Nodi..."
    (
        cd "$INSTALL_DIR"
        $COMPOSE up -d >/dev/null 2>&1
    ) &
    if ! spinner $! "Starting container"; then
        fail "Failed to start container. Check: ${CYAN}cd $INSTALL_DIR && $COMPOSE logs${NC}"
    fi

    info "Waiting for health check..."
    local healthy=false
    for i in $(seq 1 60); do
        if (
            cd "$INSTALL_DIR"
            $COMPOSE ps 2>/dev/null | grep -q "(healthy)"
        ); then
            healthy=true
            break
        fi
        sleep 1
    done

    if [ "$healthy" = false ]; then
        warn "Nodi is slow to start."
        warn "Check logs: ${CYAN}cd $INSTALL_DIR && $COMPOSE logs -f${NC}"
    fi

    step "Nodi is running"
}

# ─── Systemd Service ────────────────────────────────────────────

setup_systemd() {
    info "Creating systemd service..."

    INSTALL_ABS="$(cd "$INSTALL_DIR" && pwd)"

    sudo tee /etc/systemd/system/nodi.service > /dev/null <<EOF
[Unit]
Description=Nodi Self-Hosted File Manager
Documentation=https://github.com/Twarga/Nodi
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$INSTALL_ABS
ExecStart=$COMPOSE up -d
ExecStop=$COMPOSE down
ExecReload=$COMPOSE up -d --build
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload >/dev/null 2>&1
    sudo systemctl enable nodi >/dev/null 2>&1
    step "Systemd service created and enabled"
}

# ─── Success Screen ─────────────────────────────────────────────

show_success() {
    LOCAL_IP=""
    if command -v ip >/dev/null 2>&1; then
        LOCAL_IP=$(ip -4 route get 1 2>/dev/null | awk '{print $7; exit}')
    elif command -v hostname >/dev/null 2>&1; then
        LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
    fi

    printf "\n"
    printf "  ${GREEN}${BOLD}╭──────────────────────────────────────────╮${NC}\n"
    printf "  ${GREEN}${BOLD}│${NC}                                          ${GREEN}${BOLD}│${NC}\n"
    printf "  ${GREEN}${BOLD}│${NC}   ${BOLD}🚀  Nodi is live!${NC}                      ${GREEN}${BOLD}│${NC}\n"
    printf "  ${GREEN}${BOLD}│${NC}                                          ${GREEN}${BOLD}│${NC}\n"
    printf "  ${GREEN}${BOLD}│${NC}   ${CYAN}Local:${NC}   http://localhost:7319         ${GREEN}${BOLD}│${NC}\n"
    if [ -n "$LOCAL_IP" ]; then
        printf "  ${GREEN}${BOLD}│${NC}   ${CYAN}Network:${NC} http://${LOCAL_IP}:7319       ${GREEN}${BOLD}│${NC}\n"
    fi
    printf "  ${GREEN}${BOLD}│${NC}                                          ${GREEN}${BOLD}│${NC}\n"
    printf "  ${GREEN}${BOLD}│${NC}   ${BOLD}User:${NC}     ${WHITE}${BOLD}${USER_NAME}${NC}                     ${GREEN}${BOLD}│${NC}\n"
    printf "  ${GREEN}${BOLD}│${NC}   ${BOLD}Password:${NC} ${WHITE}${BOLD}admin${NC}                        ${GREEN}${BOLD}│${NC}\n"
    printf "  ${GREEN}${BOLD}│${NC}                                          ${GREEN}${BOLD}│${NC}\n"
    printf "  ${GREEN}${BOLD}│${NC}   ${YELLOW}⚠  Change password after first login${NC}   ${GREEN}${BOLD}│${NC}\n"
    printf "  ${GREEN}${BOLD}│${NC}                                          ${GREEN}${BOLD}│${NC}\n"
    printf "  ${GREEN}${BOLD}╰──────────────────────────────────────────╯${NC}\n"
    printf "\n"
    printf "  ${DIM}Systemd commands:${NC}\n"
    printf "    ${CYAN}sudo systemctl status nodi${NC}    — check status\n"
    printf "    ${CYAN}sudo systemctl stop nodi${NC}      — stop Nodi\n"
    printf "    ${CYAN}sudo systemctl start nodi${NC}     — start Nodi\n"
    printf "    ${CYAN}sudo systemctl restart nodi${NC}   — restart Nodi\n"
    printf "\n"
    printf "  ${DIM}Docker commands:${NC}\n"
    printf "    ${CYAN}cd $INSTALL_DIR && $COMPOSE logs -f${NC}\n"
    printf "    ${CYAN}cd $INSTALL_DIR && $COMPOSE up -d --build${NC}\n"
    printf "\n"
}

# ─── Main ───────────────────────────────────────────────────────

main() {
    banner
    preflight
    cleanup_old
    clone_repo
    write_configs
    build_image
    start_app
    setup_systemd
    show_success
}

main "$@"
