#!/usr/bin/env bash

# Nodi Uninstaller — Clean and thorough
# Removes systemd service, Docker containers, source code, and data.

set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-nodi-app}"
REMOVE_DATA="${REMOVE_DATA:-}"

# ─── Colors ─────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
DIM='\033[2m'
NC='\033[0m'
BOLD='\033[1m'

step() { printf "  ${GREEN}\u2713${NC}  %s\n" "$1"; }
info() { printf "  ${BLUE}\u2192${NC}  %s\n" "$1"; }
warn() { printf "  ${YELLOW}!${NC}  %s\n" "$1"; }
fail() {
    printf "\n  ${RED}${BOLD}\u2717  ERROR:${NC} %s\n\n" "$1" >&2
    exit 1
}

banner() {
    printf "\n"
    printf "  ${RED}${BOLD}\u256d\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256e${NC}\n"
    printf "  ${RED}${BOLD}\u2502${NC}                                          ${RED}${BOLD}\u2502${NC}\n"
    printf "  ${RED}${BOLD}\u2502${NC}  ${BOLD}Nodi Uninstaller${NC}                        ${RED}${BOLD}\u2502${NC}\n"
    printf "  ${RED}${BOLD}\u2502${NC}                                          ${RED}${BOLD}\u2502${NC}\n"
    printf "  ${RED}${BOLD}\u256f\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256f${NC}\n"
    printf "\n"
}

prompt() {
    local msg="$1"
    printf "  ${CYAN}?${NC}  %s (y/N): " "$msg"
    read -r val
    [[ "$val" == [yY] || "$val" == [yY][eE][sS] ]]
}

# ─── Detect Compose ─────────────────────────────────────────────

detect_compose() {
    COMPOSE="docker compose"
    if ! $COMPOSE version >/dev/null 2>&1; then
        if command -v docker-compose >/dev/null 2>&1; then
            COMPOSE="docker-compose"
        else
            COMPOSE=""
        fi
    fi
}

# ─── Stop and Remove Systemd ─────────────────────────────────────

remove_systemd() {
    if [ -f /etc/systemd/system/nodi.service ]; then
        info "Removing systemd service..."
        sudo systemctl stop nodi 2>/dev/null || true
        sudo systemctl disable nodi 2>/dev/null || true
        sudo rm -f /etc/systemd/system/nodi.service
        sudo systemctl daemon-reload 2>/dev/null || true
        step "Systemd service removed"
    fi
}

# ─── Stop and Remove Docker ─────────────────────────────────────

remove_docker() {
    if [ -z "$COMPOSE" ]; then
        warn "Docker Compose not found, skipping container cleanup"
        return
    fi

    if [ -d "$INSTALL_DIR" ] && [ -f "$INSTALL_DIR/docker-compose.yml" ]; then
        info "Stopping and removing Docker containers..."
        (cd "$INSTALL_DIR" && $COMPOSE down --volumes --remove-orphans 2>/dev/null) || true
        step "Docker containers and volumes removed"
    fi

    # Also try to remove by container name in case compose file is gone
    if docker ps -a --format '{{.Names}}' | grep -qx "nodi" 2>/dev/null; then
        info "Removing leftover 'nodi' container..."
        docker stop nodi 2>/dev/null || true
        docker rm nodi 2>/dev/null || true
        step "Container 'nodi' removed"
    fi

    # Remove volumes by name
    for vol in nodi-files nodi-tmp; do
        if docker volume inspect "$vol" >/dev/null 2>&1; then
            info "Removing Docker volume '$vol'..."
            docker volume rm "$vol" 2>/dev/null || true
            step "Volume '$vol' removed"
        fi
    done
}

# ─── Remove Source and Binary ───────────────────────────────────

remove_source() {
    if [ -d "$INSTALL_DIR" ]; then
        info "Removing installation directory..."
        rm -rf "$INSTALL_DIR"
        step "Directory '$INSTALL_DIR' removed"
    fi
}

# ─── Remove User Data ───────────────────────────────────────────

remove_data() {
    local data_dir=""
    if [ -d "./nodi_files" ]; then
        data_dir="./nodi_files"
    elif [ -d "$INSTALL_DIR/nodi_files" ]; then
        data_dir="$INSTALL_DIR/nodi_files"
    fi

    if [ -n "$data_dir" ] && [ -d "$data_dir" ]; then
        info "Removing user data: $data_dir"
        rm -rf "$data_dir"
        step "User data removed"
    fi
}

# ─── Remove Background Process ──────────────────────────────────

remove_bg_process() {
    if [ -f ".nodi.pid" ]; then
        local pid
        pid=$(cat ".nodi.pid" 2>/dev/null || true)
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            info "Stopping background Nodi process..."
            kill "$pid" 2>/dev/null || true
            sleep 0.5
            kill -9 "$pid" 2>/dev/null || true
            step "Background process stopped"
        fi
        rm -f ".nodi.pid"
    fi

    # Kill any remaining nodi binary by port
    local port_pid
    port_pid="$(lsof -t -i:7319 2>/dev/null || ss -tlnp 2>/dev/null | grep ':7319 ' | grep -oE 'pid=[0-9]+' | head -1 | cut -d= -f2 || true)"
    if [ -n "$port_pid" ] && kill -0 "$port_pid" 2>/dev/null; then
        info "Stopping process on port 7319..."
        kill "$port_pid" 2>/dev/null || true
        sleep 0.3
        kill -9 "$port_pid" 2>/dev/null || true
        step "Process on port 7319 stopped"
    fi
}

# ─── Clean Logs and Temp Files ──────────────────────────────────

remove_logs() {
    for f in nodi.log .nodi.pid nodi.env .env; do
        [ -f "$f" ] && rm -f "$f" && info "Removed $f"
    done
}

# ─── Main ─────────────────────────────────────────────────────

main() {
    banner

    detect_compose

    if ! prompt "Are you sure you want to uninstall Nodi?"; then
        printf "\n  ${DIM}Uninstall cancelled.${NC}\n\n"
        exit 0
    fi

    printf "\n"

    # Ask about data removal if not already specified
    if [ -z "$REMOVE_DATA" ]; then
        if prompt "Also remove all uploaded files and data?"; then
            REMOVE_DATA="yes"
        fi
    fi

    printf "\n"

    remove_systemd
    remove_docker
    remove_bg_process
    remove_source
    remove_logs

    if [ "$REMOVE_DATA" = "yes" ] || [ "$REMOVE_DATA" = "true" ]; then
        remove_data
    else
        warn "User data preserved. Delete './nodi_files' or '$INSTALL_DIR/nodi_files' manually if needed."
    fi

    printf "\n"
    printf "  ${GREEN}${BOLD}\u2713  Nodi has been uninstalled.${NC}\n"
    printf "\n"
}

main "$@"
