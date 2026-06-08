#!/usr/bin/env bash
#
# ╔═══════════════════════════════════════════════════════════════════╗
# ║                    NODI INSTALLER                                 ║
# ║          Self-hosted file manager for your network               ║
# ╚═══════════════════════════════════════════════════════════════════╝
#
# Usage:
#   bash <(curl -fsSL https://raw.githubusercontent.com/Twarga/Nodi/main/install.sh)
#
# Options:
#   --auto         Non-interactive Docker install with random password
#   --no-systemd   Skip systemd service creation

set -eo pipefail

REPO_URL="https://github.com/Twarga/Nodi.git"
INSTALL_DIR="${INSTALL_DIR:-nodi-app}"
HOST="${NODI_HOST:-0.0.0.0}"
PORT="${NODI_PORT:-7319}"
MAX_UPLOAD="${NODI_MAX_UPLOAD:-1099511627776}"
MAX_CHUNK_SIZE="${NODI_MAX_CHUNK_SIZE:-16777216}"
UPLOAD_TTL="${NODI_UPLOAD_TTL:-48h}"
TRASH_RETENTION="${NODI_TRASH_RETENTION:-720h}"

# ─── Detect mode ──────────────────────────────────────────────────
AUTO_MODE=0
NO_SYSTEMD=0
for arg in "$@"; do
    case "$arg" in
        --auto|-y)      AUTO_MODE=1 ;;
        --no-systemd)   NO_SYSTEMD=1 ;;
    esac
done
if [ "$AUTO_MODE" -eq 0 ] && [ ! -t 0 ] && [ ! -e /dev/tty ]; then
    AUTO_MODE=1
fi

# ─── Colors ───────────────────────────────────────────────────────
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

# ─── UI Helpers ───────────────────────────────────────────────────

box_top()    { printf "\n  ${CYAN}┌─────────────────────────────────────────────────────────────────┐${NC}\n"; }
box_mid()    { printf "  ${CYAN}├─────────────────────────────────────────────────────────────────┤${NC}\n"; }
box_bot()    { printf "  ${CYAN}└─────────────────────────────────────────────────────────────────┘${NC}\n\n"; }
box_title()  { printf "  ${CYAN}│${NC}  ${BOLD}${WHITE}%-63s${NC} ${CYAN}│${NC}\n" "$1"; }
box_line()   { printf "  ${CYAN}│${NC}  %-63s ${CYAN}│${NC}\n" "$1"; }
box_info()   { printf "  ${CYAN}│${NC}  ${BLUE}→${NC}  %-61s ${CYAN}│${NC}\n" "$1"; }
box_warn()   { printf "  ${CYAN}│${NC}  ${YELLOW}!${NC}  %-61s ${CYAN}│${NC}\n" "$1"; }
box_ok()     { printf "  ${CYAN}│${NC}  ${GREEN}✓${NC}  %-61s ${CYAN}│${NC}\n" "$1"; }
box_err()    { printf "  ${CYAN}│${NC}  ${RED}✗${NC}  %-61s ${CYAN}│${NC}\n" "$1"; }

header() {
    box_top
    box_title "NODI INSTALLER"
    box_title "Self-hosted file manager"
    box_bot
}

step()   { printf "  ${GREEN}✓${NC}  %s\n" "$1"; }
info()   { printf "  ${BLUE}→${NC}  %s\n" "$1" >&2; }
warn()   { printf "  ${YELLOW}!${NC}  %s\n" "$1" >&2; }
fail() {
    printf "\n  ${RED}${BOLD}✗  ERROR:${NC} %s\n\n" "$1" >&2
    printf "  ${DIM}Need help? Open an issue at:${NC}\n"
    printf "  ${CYAN}https://github.com/Twarga/Nodi/issues${NC}\n\n"
    exit 1
}

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
        printf "${CLEAR}  ${GREEN}✓${NC}  %s\n" "$msg"
    else
        printf "${CLEAR}  ${RED}✗${NC}  %s\n" "$msg"
        return $exit_code
    fi
}

# ─── Interactive Prompts ────────────────────────────────────────────

_read_input() {
    local var="$1"
    if [ -r /dev/tty ]; then
        IFS= read -r "$var" < /dev/tty
    else
        IFS= read -r "$var"
    fi
}

_read_input_silent() {
    local var="$1"
    if [ -r /dev/tty ]; then
        IFS= read -rs "$var" < /dev/tty
    else
        IFS= read -rs "$var"
    fi
}

prompt() {
    local msg="$1" default="${2:-}"
    printf "\n  ${CYAN}?${NC}  ${BOLD}%s${NC}" "$msg" >&2
    if [ -n "$default" ]; then
        printf " ${DIM}[default: %s]${NC}" "$default" >&2
    fi
    printf "\n     ${DIM}>${NC} " >&2
    local val=""
    _read_input val || true
    printf "\n" >&2
    if [ -z "$val" ] && [ -n "$default" ]; then
        val="$default"
    fi
    printf "%s\n" "$val"
}

prompt_password() {
    local msg="$1"
    local val="" val2=""
    local attempts=0
    while [ "$attempts" -lt 3 ]; do
        printf "\n  ${CYAN}?${NC}  ${BOLD}%s${NC}\n     ${DIM}(minimum 8 characters, hidden)${NC}\n     ${DIM}>${NC} " "$msg" >&2
        _read_input_silent val || true
        printf "\n" >&2
        if [ ${#val} -lt 8 ]; then
            warn "Password too short — must be at least 8 characters."
            attempts=$((attempts + 1))
            continue
        fi
        printf "  ${CYAN}?${NC}  ${BOLD}Confirm %s${NC}\n     ${DIM}>${NC} " "$msg" >&2
        _read_input_silent val2 || true
        printf "\n" >&2
        if [ "$val" != "$val2" ]; then
            warn "Passwords do not match. Please try again."
            attempts=$((attempts + 1))
            continue
        fi
        printf "%s\n" "$val"
        return
    done
    fail "Failed to set password after 3 attempts."
}

# ─── Secrets & Passwords ──────────────────────────────────────────

generate_secret() {
    if command -v openssl >/dev/null 2>&1; then
        openssl rand -base64 48 | tr -d '\n'
    else
        dd if=/dev/urandom bs=48 count=1 2>/dev/null | base64 | tr -d '\n'
    fi
}

generate_password() {
    if command -v openssl >/dev/null 2>&1; then
        openssl rand -base64 16 | tr -d '\n'
    else
        dd if=/dev/urandom bs=16 count=1 2>/dev/null | base64 | tr -d '\n' | head -c 16
    fi
}

hash_password() {
    local password="$1" hash=""
    # Try Go first (fast, no external deps if present)
    if command -v go >/dev/null 2>&1; then
        local tmpdir
        tmpdir=$(mktemp -d)
        cat > "$tmpdir/hash.go" <<'GOEOF'
package main
import ("fmt"; "os"; "golang.org/x/crypto/bcrypt")
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
        hash=$(cd "$tmpdir" && go run hash.go "$password" 2>/dev/null)
        rm -rf "$tmpdir"
    fi
    # Fallback: Python passlib
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
    # Fallback: htpasswd
    if [ -z "$hash" ] && command -v htpasswd >/dev/null 2>&1; then
        hash=$(htpasswd -nbBC 10 admin "$password" 2>/dev/null | cut -d: -f2)
    fi
    # Last resort: openssl (not bcrypt, will warn)
    if [ -z "$hash" ]; then
        hash=$(openssl passwd -6 "$password" 2>/dev/null || echo "")
        if [ -n "$hash" ]; then
            warn "Could not generate bcrypt hash (Go, Python passlib, or htpasswd required)."
            warn "The app may not accept this hash. Install Go or htpasswd and re-run."
        fi
    fi
    printf "%s\n" "$hash"
}

# ─── OS Detection ─────────────────────────────────────────────────

detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        printf "%s\n" "$ID"
    elif command -v uname >/dev/null 2>&1; then
        printf "%s\n" "$(uname -s | tr '[:upper:]' '[:lower:]')"
    else
        printf "unknown\n"
    fi
}

detect_arch() {
    local arch
    arch=$(uname -m)
    case "$arch" in
        x86_64)  printf "amd64\n" ;;
        aarch64) printf "arm64\n" ;;
        armv7l)  printf "armv6l\n" ;;
        *)       printf "%s\n" "$arch" ;;
    esac
}

is_wsl() {
    if [ -f /proc/sys/fs/binfmt_misc/WSLInterop ] || [ -n "${WSL_DISTRO_NAME:-}" ]; then
        return 0
    fi
    if grep -qi microsoft /proc/version 2>/dev/null; then
        return 0
    fi
    return 1
}

# ─── Auto-install dependencies ────────────────────────────────────

install_go() {
    local os arch version url tmpdir
    os="linux"
    arch=$(detect_arch)
    version="1.24.4"
    url="https://go.dev/dl/go${version}.${os}-${arch}.tar.gz"
    tmpdir=$(mktemp -d)
    info "Downloading Go ${version} for ${os}/${arch}..."
    if ! curl -fsSL "$url" -o "$tmpdir/go.tar.gz" 2>/dev/null; then
        rm -rf "$tmpdir"
        return 1
    fi
    info "Extracting Go to /usr/local..."
    sudo tar -C /usr/local -xzf "$tmpdir/go.tar.gz"
    rm -rf "$tmpdir"
    export PATH="/usr/local/go/bin:$PATH"
    if command -v go >/dev/null 2>&1; then
        step "Go $(go version | awk '{print $3}') installed"
        return 0
    fi
    return 1
}

install_node() {
    local os arch version url tmpdir
    os="linux"
    arch=$(uname -m)
    case "$arch" in
        x86_64)  arch="x64" ;;
        aarch64) arch="arm64" ;;
    esac
    version="22.16.0"
    url="https://nodejs.org/dist/v${version}/node-v${version}-${os}-${arch}.tar.xz"
    tmpdir=$(mktemp -d)
    info "Downloading Node.js ${version} for ${os}/${arch}..."
    if ! curl -fsSL "$url" -o "$tmpdir/node.tar.xz" 2>/dev/null; then
        rm -rf "$tmpdir"
        return 1
    fi
    info "Extracting Node.js to /usr/local..."
    sudo tar -C /usr/local --strip-components=1 -xf "$tmpdir/node.tar.xz"
    rm -rf "$tmpdir"
    export PATH="/usr/local/bin:$PATH"
    if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
        step "Node.js $(node --version) + npm $(npm --version) installed"
        return 0
    fi
    return 1
}

ensure_go() {
    if command -v go >/dev/null 2>&1; then
        local gv
        gv=$(go version | awk '{print $3}')
        step "Go ${gv} already installed"
        return 0
    fi
    box_top
    box_warn "Go is not installed"
    box_info "Nodi needs Go to build from source."
    box_info "I can download and install it automatically."
    box_bot
    local choice
    choice=$(prompt "Auto-install Go now?" "yes")
    if [ "$choice" != "n" ] && [ "$choice" != "no" ] && [ "$choice" != "N" ]; then
        if install_go; then
            return 0
        fi
    fi
    fail "Go is required for direct install.\n\n  Install Go 1.24+ first:\n  ${CYAN}https://go.dev/doc/install${NC}"
}

ensure_node() {
    if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
        step "Node.js $(node --version) + npm $(npm --version) already installed"
        return 0
    fi
    box_top
    box_warn "Node.js is not installed"
    box_info "Nodi needs Node.js and npm to build the frontend."
    box_info "I can download and install them automatically."
    box_bot
    local choice
    choice=$(prompt "Auto-install Node.js now?" "yes")
    if [ "$choice" != "n" ] && [ "$choice" != "no" ] && [ "$choice" != "N" ]; then
        if install_node; then
            return 0
        fi
    fi
    fail "Node.js and npm are required for direct install.\n\n  Install Node.js 22+ first:\n  ${CYAN}https://nodejs.org/${NC}"
}

# ─── Installation Steps ───────────────────────────────────────────

choose_install_mode() {
    if [ "$AUTO_MODE" -eq 1 ]; then
        info "Auto mode: using Docker install"
        INSTALL_MODE="1"
        return
    fi
    box_top
    box_title "How would you like to install Nodi?"
    box_bot
    printf "  ${CYAN}1)${NC}  ${BOLD}Docker${NC}        ${DIM}Recommended — easy updates, fully isolated${NC}\n"
    printf "  ${CYAN}2)${NC}  ${BOLD}Direct / Native${NC} ${DIM}Builds from source, no containers${NC}\n\n"
    local choice=""
    while [ "$choice" != "1" ] && [ "$choice" != "2" ]; do
        choice=$(prompt "Choose 1 or 2" "1")
        if [ "$choice" != "1" ] && [ "$choice" != "2" ]; then
            warn "Please enter 1 or 2."
        fi
    done
    INSTALL_MODE="$choice"
}

ask_credentials() {
    if [ "$AUTO_MODE" -eq 1 ]; then
        info "Auto mode: creating admin account with generated password"
        USER_NAME="admin"
        ADMIN_PASSWORD="$(generate_password)"
        info "Hashing password..."
        PASS_HASH="$(hash_password "$ADMIN_PASSWORD")"
        if [ -z "$PASS_HASH" ]; then
            fail "Could not generate password hash. Install Go, htpasswd, or Python passlib."
        fi
        return
    fi
    box_top
    box_title "Create your admin account"
    box_bot
    local username password hash
    username=$(prompt "Username" "admin")
    password=$(prompt_password "Password")
    printf "\n" >&2
    info "Hashing password..."
    hash=$(hash_password "$password")
    if [ -z "$hash" ]; then
        fail "Could not generate password hash. Install Go (golang.org) or htpasswd (apache2-utils) and try again."
    fi
    USER_NAME="$username"
    PASS_HASH="$hash"
    ADMIN_PASSWORD="$password"
}

cleanup_old() {
    if [ -d "$INSTALL_DIR" ]; then
        info "Removing old install directory: $INSTALL_DIR"
        rm -rf "$INSTALL_DIR"
    fi
}

clone_repo() {
    info "Cloning latest source code..."
    (git clone --depth=1 "$REPO_URL" "$INSTALL_DIR" >/dev/null 2>&1) &
    spinner $! "Cloning repository"
    step "Latest source cloned"
}

write_env_file() {
    local out="$1"
    local secret="$(generate_secret)"
    cat > "$out" <<EOF
QL_HOST=$HOST
QL_PORT=$PORT
QL_ROOT=/nodi_files
QL_USER=$USER_NAME
QL_PASS_HASH=$PASS_HASH
QL_COOKIE_SECRET=$secret
QL_MAX_UPLOAD=$MAX_UPLOAD
QL_MAX_CHUNK_SIZE=$MAX_CHUNK_SIZE
QL_UPLOAD_TTL=$UPLOAD_TTL
QL_TRASH_RETENTION=$TRASH_RETENTION
GOTMPDIR=/nodi_files/.cache/tmp
EOF
    step "Environment file written"
}

write_docker_compose() {
    local out="$1"
    local compose
    if command -v docker-compose >/dev/null 2>&1; then
        compose="docker-compose"
    else
        compose="docker compose"
    fi
    COMPOSE="$compose"
    cat > "$out" <<EOF
services:
  nodi:
    build: .
    ports:
      - "$PORT:$PORT"
    env_file:
      - nodi.env
    volumes:
      - nodi_files:/nodi_files
    restart: unless-stopped

volumes:
  nodi_files:
EOF
    step "Docker Compose file written"
}

build_image() {
    info "Building Docker image..."
    (cd "$INSTALL_DIR" && $COMPOSE build --no-cache >/dev/null 2>&1) &
    spinner $! "Building Docker image"
}

start_docker_app() {
    info "Starting Nodi..."
    (cd "$INSTALL_DIR" && $COMPOSE up -d >/dev/null 2>&1) &
    spinner $! "Starting containers"
}

setup_docker_systemd() {
    if [ "$NO_SYSTEMD" -eq 1 ]; then return; fi
    if ! command -v systemctl >/dev/null 2>&1; then
        warn "systemctl not found — skipping systemd service"
        return
    fi
    local svc="/etc/systemd/system/nodi.service"
    local compose_path
    compose_path="$(cd "$INSTALL_DIR" && pwd)/docker-compose.yml"
    cat > /tmp/nodi.service <<EOF
[Unit]
Description=Nodi File Manager (Docker)
After=docker.service network.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$(cd "$INSTALL_DIR" && pwd)
ExecStart=$COMPOSE -f $compose_path up -d
ExecStop=$COMPOSE -f $compose_path down

[Install]
WantedBy=multi-user.target
EOF
    sudo mv /tmp/nodi.service "$svc"
    sudo systemctl daemon-reload >/dev/null 2>&1
    sudo systemctl enable nodi >/dev/null 2>&1
    step "Systemd service created: nodi"
}

preflight_direct() {
    ensure_go
    ensure_node
}

build_direct() {
    info "Building frontend..."
    (cd "$INSTALL_DIR/web/app" && npm ci --no-audit --no-fund >/dev/null 2>&1 && npm run build >/dev/null 2>&1) &
    spinner $! "Building frontend"

    info "Building Go server..."
    (cd "$INSTALL_DIR" && go build -trimpath -ldflags="-s -w" -o nodi ./cmd/server >/dev/null 2>&1) &
    spinner $! "Building Go server"
}

start_direct_app() {
    info "Starting Nodi..."
    mkdir -p "$INSTALL_DIR/nodi_files/.cache/tmp"
    export GOTMPDIR="$INSTALL_DIR/nodi_files/.cache/tmp"
    set -a
    . "$INSTALL_DIR/nodi.env"
    set +a
    nohup "$INSTALL_DIR/nodi" > "$INSTALL_DIR/nodi.log" 2>&1 &
    step "Nodi started (PID $!)"
}

setup_direct_systemd() {
    if [ "$NO_SYSTEMD" -eq 1 ]; then return; fi
    if ! command -v systemctl >/dev/null 2>&1; then
        warn "systemctl not found — skipping systemd service"
        return
    fi
    local svc="/etc/systemd/system/nodi.service"
    local bin_path env_path
    bin_path="$(cd "$INSTALL_DIR" && pwd)/nodi"
    env_path="$(cd "$INSTALL_DIR" && pwd)/nodi.env"
    cat > /tmp/nodi.service <<EOF
[Unit]
Description=Nodi File Manager
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$(cd "$INSTALL_DIR" && pwd)
EnvironmentFile=$env_path
ExecStart=$bin_path
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF
    sudo mv /tmp/nodi.service "$svc"
    sudo systemctl daemon-reload >/dev/null 2>&1
    sudo systemctl enable nodi >/dev/null 2>&1
    sudo systemctl start nodi >/dev/null 2>&1
    step "Systemd service created and started: nodi"
}

show_success() {
    local LOCAL_IP=""
    if command -v ip >/dev/null 2>&1; then
        LOCAL_IP=$(ip -4 route get 1 2>/dev/null | awk '{print $7; exit}')
    elif command -v hostname >/dev/null 2>&1; then
        LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
    fi

    box_top
    box_ok "Nodi is live!"
    box_bot

    printf "  ${BOLD}URLs${NC}\n"
    printf "  ${CYAN}Local:${NC}   http://localhost:$PORT\n"
    if [ -n "$LOCAL_IP" ]; then
        printf "  ${CYAN}LAN:${NC}     http://${LOCAL_IP}:$PORT\n"
    fi
    printf "\n"
    printf "  ${BOLD}Credentials${NC}\n"
    printf "  ${CYAN}User:${NC}     $USER_NAME\n"
    printf "  ${CYAN}Password:${NC} $ADMIN_PASSWORD\n"
    printf "\n"

    if [ "$AUTO_MODE" -eq 1 ]; then
        printf "  ${YELLOW}!  Save this password — it was auto-generated.${NC}\n\n"
    else
        printf "  ${YELLOW}!  Change it from Settings after first login${NC}\n\n"
    fi

    if [ "$INSTALL_MODE" = "1" ]; then
        printf "  ${DIM}Docker commands${NC}\n"
        printf "  ${CYAN}cd $INSTALL_DIR && $COMPOSE logs -f${NC}\n"
        printf "  ${CYAN}cd $INSTALL_DIR && $COMPOSE up -d --build${NC}\n\n"
    else
        if [ "$NO_SYSTEMD" -eq 1 ]; then
            printf "  ${DIM}Manual commands${NC}\n"
            printf "  ${CYAN}cd $INSTALL_DIR && ./nodi${NC}\n"
            printf "  ${CYAN}tail -f $INSTALL_DIR/nodi.log${NC}\n\n"
        else
            printf "  ${DIM}Systemd commands${NC}\n"
            printf "  ${CYAN}sudo systemctl status nodi${NC}\n"
            printf "  ${CYAN}sudo systemctl stop nodi${NC}\n"
            printf "  ${CYAN}sudo systemctl restart nodi${NC}\n"
            printf "  ${CYAN}tail -f $INSTALL_DIR/nodi.log${NC}\n\n"
        fi
    fi
}

# ─── Main ─────────────────────────────────────────────────────────

main() {
    header
    choose_install_mode
    ask_credentials
    cleanup_old
    clone_repo
    write_env_file "$INSTALL_DIR/nodi.env"

    if [ "$INSTALL_MODE" = "1" ]; then
        write_docker_compose "$INSTALL_DIR/docker-compose.yml"
        build_image
        start_docker_app
        if [ "$NO_SYSTEMD" -eq 1 ]; then
            info "Skipping systemd service (--no-systemd)"
        else
            setup_docker_systemd
        fi
    else
        preflight_direct
        build_direct
        start_direct_app
        if [ "$NO_SYSTEMD" -eq 1 ]; then
            info "Skipping systemd service (--no-systemd)"
        else
            setup_direct_systemd
        fi
    fi

    show_success
}

main "$@"
