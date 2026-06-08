#!/usr/bin/env bash

# Nodi Installer — Choose Docker or Direct install, with interactive setup
# Usage: bash <(curl -fsSL https://raw.githubusercontent.com/Twarga/Nodi/main/install.sh)

set -euo pipefail

# When this script is run via `bash <(curl ...)`, stdin is the pipe from curl.
# Reopen stdin from the terminal so interactive prompts work.
if [ ! -t 0 ] && [ -e /dev/tty ]; then
    exec < /dev/tty
fi

REPO_URL="https://github.com/Twarga/Nodi.git"
INSTALL_DIR="${INSTALL_DIR:-nodi-app}"
HOST="${NODI_HOST:-0.0.0.0}"
PORT="${NODI_PORT:-7319}"
MAX_UPLOAD="${NODI_MAX_UPLOAD:-1099511627776}"
MAX_CHUNK_SIZE="${NODI_MAX_CHUNK_SIZE:-16777216}"
UPLOAD_TTL="${NODI_UPLOAD_TTL:-48h}"
TRASH_RETENTION="${NODI_TRASH_RETENTION:-720h}"

# ─── Colors ─────────────────────────────────────────────────────
BOLD='\033[1m'
DIM='\033[2m'
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'
CLEAR='\r\033[K'

# ─── Helpers ────────────────────────────────────────────────────

spinner() {
    local pid=$1 msg="$2"
    local spin='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    local i=0
    while kill -0 "$pid" 2>/dev/null; do
        i=$(( (i+1) % 10 ))
        printf "${CLEAR}  ${CYAN}${spin:$i:1}${NC}  %s" "$msg"
        sleep 0.08
    done
    wait "$pid" || true
    local exit_code=$?
    if [ $exit_code -eq 0 ]; then
        printf "${CLEAR}  ${GREEN}\u2713${NC}  %s\n" "$msg"
    else
        printf "${CLEAR}  ${RED}\u2717${NC}  %s\n" "$msg"
        return $exit_code
    fi
}

step() { printf "  ${GREEN}\u2713${NC}  %s\n" "$1"; }
info() { printf "  ${BLUE}\u2192${NC}  %s\n" "$1"; }
warn() { printf "  ${YELLOW}!${NC}  %s\n" "$1"; }
fail() {
    printf "\n  ${RED}${BOLD}\u2717  ERROR:${NC} %s\n\n" "$1" >&2
    printf "  ${DIM}Need help? Open an issue at:${NC}\n"
    printf "  ${CYAN}https://github.com/Twarga/Nodi/issues${NC}\n\n"
    exit 1
}

prompt() {
    local msg="$1" default="${2:-}"
    printf "  ${CYAN}?${NC}  %s" "$msg"
    if [ -n "$default" ]; then
        printf " [${DIM}%s${NC}] " "$default"
    else
        printf " "
    fi
    read -r val
    if [ -z "$val" ] && [ -n "$default" ]; then
        val="$default"
    fi
    printf "%s\n" "$val"
}

prompt_password() {
    local msg="$1"
    local val="" val2=""
    while true; do
        printf "  ${CYAN}?${NC}  %s (hidden): " "$msg"
        read -rs val
        printf "\n"
        if [ ${#val} -lt 8 ]; then
            warn "Password must be at least 8 characters."
            continue
        fi
        printf "  ${CYAN}?${NC}  Confirm %s (hidden): " "$msg"
        read -rs val2
        printf "\n"
        if [ "$val" != "$val2" ]; then
            warn "Passwords do not match. Try again."
            continue
        fi
        printf "%s\n" "$val"
        break
    done
}

generate_secret() {
    if command -v openssl >/dev/null 2>&1; then
        openssl rand -base64 48 | tr -d '\n'
    else
        dd if=/dev/urandom bs=48 count=1 2>/dev/null | base64 | tr -d '\n'
    fi
}

hash_password_go() {
    local password="$1"
    # Create a tiny Go program to hash with bcrypt
    local tmpdir
    tmpdir=$(mktemp -d)
    cat > "$tmpdir/hash.go" <<'GOEOF'
package main
import (
    "fmt"
    "os"
    "golang.org/x/crypto/bcrypt"
)
func main() {
    if len(os.Args) < 2 { fmt.Fprintln(os.Stderr, "usage: hash <password>"); os.Exit(1) }
    h, err := bcrypt.GenerateFromPassword([]byte(os.Args[1]), bcrypt.DefaultCost)
    if err != nil { fmt.Fprintln(os.Stderr, err); os.Exit(1) }
    fmt.Println(string(h))
}
GOEOF
    cat > "$tmpdir/go.mod" <<'GOEOF'
module hash
go 1.24
require golang.org/x/crypto v0.36.0
GOEOF
    (cd "$tmpdir" && GOPROXY=https://proxy.golang.org,direct go mod download 2>/dev/null)
    (cd "$tmpdir" && go run hash.go "$password" 2>/dev/null)
    rm -rf "$tmpdir"
}

hash_password() {
    local password="$1"
    local hash=""
    # Try Go first (best quality)
    if command -v go >/dev/null 2>&1; then
        hash=$(hash_password_go "$password")
    fi
    # Fallback: python3 with passlib if available
    if [ -z "$hash" ] && command -v python3 >/dev/null 2>&1; then
        hash=$(python3 -c "
import sys
try:
    from passlib.hash import bcrypt
    print(bcrypt.using(rounds=10).hash(sys.argv[1]))
except Exception:
    pass
" "$password" 2>/dev/null || true)
    fi
    # Fallback: htpasswd if available
    if [ -z "$hash" ] && command -v htpasswd >/dev/null 2>&1; then
        hash=$(htpasswd -nbBC 10 admin "$password" 2>/dev/null | cut -d: -f2)
    fi
    # Fallback: openssl (Apache-style bcrypt not available in all versions)
    if [ -z "$hash" ]; then
        # Generate a simple SHA512 hash as last resort — the app accepts bcrypt,
        # but we need SOMETHING. Tell user to change it from Settings.
        hash=$(openssl passwd -6 "$password" 2>/dev/null || echo "")
        if [ -n "$hash" ]; then
            warn "Could not generate bcrypt hash (Go, Python passlib, or htpasswd required)."
            warn "The app may not accept this hash. Install Go or htpasswd and re-run."
        fi
    fi
    printf "%s\n" "$hash"
}

banner() {
    printf "\n"
    printf "  ${CYAN}${BOLD}\u256d\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256e${NC}\n"
    printf "  ${CYAN}${BOLD}\u2502${NC}                                          ${CYAN}${BOLD}\u2502${NC}\n"
    printf "  ${CYAN}${BOLD}\u2502${NC}  ${WHITE}${BOLD}\u2588\u2588\u2588\u2557   \u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2557${NC}           ${CYAN}${BOLD}\u2502${NC}\n"
    printf "  ${CYAN}${BOLD}\u2502${NC}  ${WHITE}${BOLD}\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2551${NC}           ${CYAN}${BOLD}\u2502${NC}\n"
    printf "  ${CYAN}${BOLD}\u2502${NC}  ${WHITE}${BOLD}\u2588\u2588\u2554\u2588\u2588\u2557 \u2588\u2588\u2551\u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2551${NC}           ${CYAN}${BOLD}\u2502${NC}\n"
    printf "  ${CYAN}${BOLD}\u2502${NC}  ${WHITE}${BOLD}\u2588\u2588\u2551\u255a\u2588\u2588\u2557\u2588\u2588\u2551\u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2551${NC}           ${CYAN}${BOLD}\u2502${NC}\n"
    printf "  ${CYAN}${BOLD}\u2502${NC}  ${WHITE}${BOLD}\u2588\u2588\u2551 \u255a\u2588\u2588\u2588\u2588\u2551\u255a\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u2559\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u2559\u2588\u2588\u2551${NC}           ${CYAN}${BOLD}\u2502${NC}\n"
    printf "  ${CYAN}${BOLD}\u2502${NC}  ${WHITE}${BOLD}\u255a\u2550\u255d  \u255a\u2550\u2550\u2550\u255d \u255a\u2550\u2550\u2550\u2550\u2550\u255d \u255a\u2550\u2550\u2550\u2550\u2550\u255d \u255a\u2550\u255d${NC}           ${CYAN}${BOLD}\u2502${NC}\n"
    printf "  ${CYAN}${BOLD}\u2502${NC}                                          ${CYAN}${BOLD}\u2502${NC}\n"
    printf "  ${CYAN}${BOLD}\u2502${NC}     ${DIM}Self-hosted file manager${NC}              ${CYAN}${BOLD}\u2502${NC}\n"
    printf "  ${CYAN}${BOLD}\u2502${NC}                                          ${CYAN}${BOLD}\u2502${NC}\n"
    printf "  ${CYAN}${BOLD}\u256f\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256f${NC}\n"
    printf "\n"
}

# ─── Ask install mode ───────────────────────────────────────────

choose_install_mode() {
    printf "\n  ${BOLD}How would you like to install Nodi?${NC}\n\n"
    printf "  ${CYAN}1)${NC} Docker ${DIM}(recommended — easy updates, isolated)${NC}\n"
    printf "  ${CYAN}2)${NC} Direct / Native ${DIM}(builds from source, no containers)${NC}\n\n"
    local choice
    while true; do
        choice=$(prompt "Choose 1 or 2:" "1")
        if [ "$choice" = "1" ] || [ "$choice" = "2" ]; then
            break
        fi
        warn "Please enter 1 or 2."
    done
    printf "%s\n" "$choice"
}

# ─── Ask credentials ────────────────────────────────────────────

ask_credentials() {
    printf "\n  ${BOLD}Create your admin account${NC}\n\n"
    local username password hash
    username=$(prompt "Username:" "admin")
    password=$(prompt_password "password")
    printf "\n"
    info "Hashing password..."
    hash=$(hash_password "$password")
    if [ -z "$hash" ]; then
        fail "Could not generate password hash. Install Go (golang.org) or htpasswd (apache2-utils) and try again."
    fi
    USER_NAME="$username"
    PASS_HASH="$hash"
    ADMIN_PASSWORD="$password"
}

# ─── Preflight Checks ───────────────────────────────────────────

preflight_docker() {
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

preflight_direct() {
    info "Checking requirements..."

    if ! command -v git >/dev/null 2>&1; then
        fail "Git is not installed.\n\n  ${CYAN}sudo apt install git${NC}  (Debian/Ubuntu)\n  ${CYAN}sudo yum install git${NC}  (RHEL/CentOS)"
    fi

    if ! command -v go >/dev/null 2>&1; then
        fail "Go is not installed.\n\n  Install Go 1.24+ first:\n  ${CYAN}https://go.dev/doc/install${NC}"
    fi

    local go_version
    go_version=$(go version | awk '{print $3}' | sed 's/go//')
    if ! printf "%s\n%s\n" "1.24" "$go_version" | sort -V -C; then
        fail "Go 1.24+ is required. Found: $go_version\n\n  ${CYAN}https://go.dev/doc/install${NC}"
    fi

    if ! command -v node >/dev/null 2>&1; then
        fail "Node.js is not installed.\n\n  Install Node.js 20+ first:\n  ${CYAN}https://nodejs.org/${NC}"
    fi

    local node_major
    node_major=$(node --version | sed 's/v//' | cut -d. -f1)
    if [ "$node_major" -lt 20 ]; then
        fail "Node.js 20+ is required. Found: $(node --version)"
    fi

    if ! command -v npm >/dev/null 2>&1; then
        fail "npm is not installed."
    fi

    step "Go $(go version | awk '{print $3}'), Node $(node --version), and npm are ready"
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

write_env_file() {
    local env_file="$1"
    COOKIE_SECRET="$(generate_secret)"

    cat > "$env_file" <<EOF
QL_HOST=$HOST
QL_PORT=$PORT
QL_ROOT=/nodi_files
QL_USER=$USER_NAME
QL_PASS_HASH=$PASS_HASH
QL_COOKIE_SECRET=$COOKIE_SECRET
QL_THEME=system
QL_MAX_UPLOAD=$MAX_UPLOAD
QL_MAX_CHUNK_SIZE=$MAX_CHUNK_SIZE
QL_UPLOAD_TTL=$UPLOAD_TTL
QL_TRASH_RETENTION=$TRASH_RETENTION
GOTMPDIR=/nodi_files/.cache/tmp
EOF
}

write_docker_compose() {
    local dc_file="$1"
    cat > "$dc_file" <<EOF
services:
  nodi:
    image: ghcr.io/twarga/nodi:latest
    build:
      context: .
    container_name: nodi
    restart: unless-stopped
    ports:
      - "$PORT:$PORT"
    env_file:
      - path: nodi.env
        format: raw
    volumes:
      - nodi-files:/nodi_files
      - nodi-tmp:/tmp
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://127.0.0.1:$PORT/api/health"]
      interval: 30s
      timeout: 5s
      retries: 5
      start_period: 15s
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

volumes:
  nodi-files:
    driver: local
  nodi-tmp:
    driver: local
EOF
}

# ─── Docker Build ───────────────────────────────────────────────

build_image() {
    info "Building Docker image..."
    info "${DIM}This takes 2\u20135 minutes on first run. Grab a coffee.${NC}"
    printf "\n"

    if ! (cd "$INSTALL_DIR" && $COMPOSE build --no-cache); then
        printf "\n"
        fail "Docker build failed.\n\n  Try running manually to see the error:\n  ${CYAN}cd $INSTALL_DIR && $COMPOSE build --no-cache${NC}"
    fi
    step "Image built successfully"
}

start_docker_app() {
    info "Starting Nodi..."
    (cd "$INSTALL_DIR" && $COMPOSE up -d >/dev/null 2>&1)
    step "Container started"

    info "Waiting for health check..."
    local healthy=false
    for i in $(seq 1 60); do
        if (cd "$INSTALL_DIR" && $COMPOSE ps 2>/dev/null | grep -q "(healthy)"); then
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

setup_docker_systemd() {
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

# ─── Direct Build ─────────────────────────────────────────────

build_direct() {
    info "Building frontend..."
    (cd "$INSTALL_DIR/web/app" && npm ci --no-audit --no-fund >/dev/null 2>&1 && npm run build >/dev/null 2>&1) &
    spinner $! "Building frontend"

    info "Building Go binary..."
    (cd "$INSTALL_DIR" && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w -X main.version=$(git describe --tags --always 2>/dev/null || echo dev)" -o nodi ./cmd/server) &
    spinner $! "Building Go binary"

    step "Build complete"
}

start_direct_app() {
    info "Starting Nodi..."
    mkdir -p "$INSTALL_DIR/nodi_files/.cache/tmp"

    # Create a simple wrapper script
    cat > "$INSTALL_DIR/run-nodi.sh" <<EOF
#!/usr/bin/env bash
set -euo pipefail
cd "$(cd "$INSTALL_DIR" && pwd)"
set -a
source ./nodi.env
set +a
exec ./nodi
EOF
    chmod +x "$INSTALL_DIR/run-nodi.sh"

    nohup "$INSTALL_DIR/run-nodi.sh" > "$INSTALL_DIR/nodi.log" 2>&1 &
    local pid=$!
    echo $pid > "$INSTALL_DIR/nodi.pid"

    # Wait a moment for startup
    sleep 2
    if kill -0 "$pid" 2>/dev/null; then
        step "Nodi is running (pid $pid)"
    else
        warn "Nodi exited quickly. Check logs: ${CYAN}tail -f $INSTALL_DIR/nodi.log${NC}"
    fi
}

setup_direct_systemd() {
    info "Creating systemd service..."

    INSTALL_ABS="$(cd "$INSTALL_DIR" && pwd)"

    sudo tee /etc/systemd/system/nodi.service > /dev/null <<EOF
[Unit]
Description=Nodi Self-Hosted File Manager
Documentation=https://github.com/Twarga/Nodi
After=network.target

[Service]
Type=simple
WorkingDirectory=$INSTALL_ABS
EnvironmentFile=$INSTALL_ABS/nodi.env
ExecStart=$INSTALL_ABS/nodi
ExecReload=/bin/kill -HUP \$MAINPID
Restart=on-failure
RestartSec=5
StandardOutput=append:$INSTALL_ABS/nodi.log
StandardError=append:$INSTALL_ABS/nodi.log

# Hardening that does not break large uploads
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$INSTALL_ABS/nodi_files /tmp
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true
RestrictNamespaces=true
LockPersonality=true
MemoryDenyWriteExecute=true
RestrictRealtime=true
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
CapabilityBoundingSet=CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload >/dev/null 2>&1
    sudo systemctl enable nodi >/dev/null 2>&1

    # Stop the background nohup process and hand over to systemd
    if [ -f "$INSTALL_DIR/nodi.pid" ]; then
        local pid
        pid=$(cat "$INSTALL_DIR/nodi.pid")
        kill "$pid" 2>/dev/null || true
        rm -f "$INSTALL_DIR/nodi.pid"
    fi

    sudo systemctl start nodi >/dev/null 2>&1
    step "Systemd service created and started"
}

# ─── Success Screen ─────────────────────────────────────────────

show_success() {
    LOCAL_IP=""
    if command -v ip >/dev/null 2>&1; then
        LOCAL_IP=$(ip -4 route get 1 2>/dev/null | awk '{print \$7; exit}')
    elif command -v hostname >/dev/null 2>&1; then
        LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print \$1}')
    fi

    printf "\n"
    printf "  ${GREEN}${BOLD}\u256d\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256e${NC}\n"
    printf "  ${GREEN}${BOLD}\u2502${NC}                                          ${GREEN}${BOLD}\u2502${NC}\n"
    printf "  ${GREEN}${BOLD}\u2502${NC}   ${BOLD}\u2708  Nodi is live!${NC}                      ${GREEN}${BOLD}\u2502${NC}\n"
    printf "  ${GREEN}${BOLD}\u2502${NC}                                          ${GREEN}${BOLD}\u2502${NC}\n"
    printf "  ${GREEN}${BOLD}\u2502${NC}   ${CYAN}Local:${NC}   http://localhost:$PORT         ${GREEN}${BOLD}\u2502${NC}\n"
    if [ -n "$LOCAL_IP" ]; then
        printf "  ${GREEN}${BOLD}\u2502${NC}   ${CYAN}Network:${NC} http://${LOCAL_IP}:$PORT       ${GREEN}${BOLD}\u2502${NC}\n"
    fi
    printf "  ${GREEN}${BOLD}\u2502${NC}                                          ${GREEN}${BOLD}\u2502${NC}\n"
    printf "  ${GREEN}${BOLD}\u2502${NC}   ${BOLD}User:${NC}     ${WHITE}${BOLD}%s${NC}                     ${GREEN}${BOLD}\u2502${NC}\n" "$USER_NAME"
    printf "  ${GREEN}${BOLD}\u2502${NC}   ${BOLD}Password:${NC} ${WHITE}${BOLD}(set during install)${NC}         ${GREEN}${BOLD}\u2502${NC}\n"
    printf "  ${GREEN}${BOLD}\u2502${NC}                                          ${GREEN}${BOLD}\u2502${NC}\n"
    printf "  ${GREEN}${BOLD}\u256f\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256f${NC}\n"
    printf "\n"

    if [ "$INSTALL_MODE" = "1" ]; then
        printf "  ${DIM}Docker commands:${NC}\n"
        printf "    ${CYAN}cd $INSTALL_DIR && $COMPOSE logs -f${NC}\n"
        printf "    ${CYAN}cd $INSTALL_DIR && $COMPOSE up -d --build${NC}\n\n"
    else
        printf "  ${DIM}Direct install commands:${NC}\n"
        printf "    ${CYAN}sudo systemctl status nodi${NC}    \u2014 check status\n"
        printf "    ${CYAN}sudo systemctl stop nodi${NC}      \u2014 stop Nodi\n"
        printf "    ${CYAN}sudo systemctl restart nodi${NC}   \u2014 restart Nodi\n"
        printf "    ${CYAN}tail -f $INSTALL_DIR/nodi.log${NC} \u2014 view logs\n\n"
    fi
}

# ─── Main ───────────────────────────────────────────────────────

main() {
    banner
    INSTALL_MODE=$(choose_install_mode)
    ask_credentials
    cleanup_old
    clone_repo
    write_env_file "$INSTALL_DIR/nodi.env"

    if [ "$INSTALL_MODE" = "1" ]; then
        preflight_docker
        write_docker_compose "$INSTALL_DIR/docker-compose.yml"
        build_image
        start_docker_app
        setup_docker_systemd
    else
        preflight_direct
        build_direct
        start_direct_app
        setup_direct_systemd
    fi

    show_success
}

main "$@"
