#!/usr/bin/env bash

set -euo pipefail

BOLD='\033[1m'
DIM='\033[2m'
UNDERLINE='\033[4m'
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
WHITE='\033[0;37m'
NC='\033[0m'

APP_NAME="${APP_NAME:-nodi}"
INSTALL_DIR="${INSTALL_DIR:-nodi-app}"
IMAGE="${NODI_IMAGE:-ghcr.io/twarga/nodi:latest}"
PORT="${NODI_PORT:-7319}"
HOST="${NODI_HOST:-0.0.0.0}"
USER_NAME="${NODI_USER:-admin}"
PASSWORD_HASH="${NODI_PASS_HASH:-\$2b\$10\$giD/vH5ZWt26q8GEN0PdZejq/ZdpxdMci5bK4U2fnLHj1mfqZXmCy}"
MAX_UPLOAD="${NODI_MAX_UPLOAD:-2147483648}"
DRY_RUN=false
INTERACTIVE=false
NO_PULL=false
BUILD=false

spinner_pid=""

banner() {
    printf "\n"
    printf "  ${CYAN}${BOLD}╔══════════════════════════════════════╗${NC}\n"
    printf "  ${CYAN}${BOLD}║${NC}                                      ${CYAN}${BOLD}║${NC}\n"
    printf "  ${CYAN}${BOLD}║${NC}   ${WHITE}${BOLD}█╗   ██╗ ██████╗ ⊙███╗   █╗${NC}        ${CYAN}${BOLD}║${NC}\n"
    printf "  ${CYAN}${BOLD}║${NC}   ${WHITE}${BOLD}██╗  ██║██╔════╝ ████╗  ██║${NC}        ${CYAN}${BOLD}║${NC}\n"
    printf "  ${CYAN}${BOLD}║${NC}   ${WHITE}${BOLD}███╗███║██║  ███╗██╔██╗ ██║${NC}        ${CYAN}${BOLD}║${NC}\n"
    printf "  ${CYAN}${BOLD}║${NC}   ${WHITE}${BOLD}███╔████║██║   ██║██║╚██╗██║${NC}        ${CYAN}${BOLD}║${NC}\n"
    printf "  ${CYAN}${BOLD}║${NC}   ${WHITE}${BOLD}██╔╝╰██║╚██████╔╝██║ ╚████║${NC}        ${CYAN}${BOLD}║${NC}\n"
    printf "  ${CYAN}${BOLD}║${NC}   ${WHITE}${BOLD}╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝${NC}        ${CYAN}${BOLD}║${NC}\n"
    printf "  ${CYAN}${BOLD}║${NC}                                      ${CYAN}${BOLD}║${NC}\n"
    printf "  ${CYAN}${BOLD}║${NC}     ${DIM}Self-hosted file manager${NC}         ${CYAN}${BOLD}║${NC}\n"
    printf "  ${CYAN}${BOLD}║${NC}                                      ${CYAN}${BOLD}║${NC}\n"
    printf "  ${CYAN}${BOLD}╚══════════════════════════════════════╝${NC}\n"
    printf "\n"
}

step() {
    printf "  ${GREEN}${BOLD}✓${NC}  %s\n" "$1"
}

step_start() {
    printf "  ${CYAN}⠿${NC}  %s  " "$1"
    _spinner_msg="$1"
}

step_done() {
    printf "\r  ${GREEN}${BOLD}✓${NC}  %s\n" "${_spinner_msg:-done}"
}

step_fail() {
    printf "\r  ${RED}${BOLD}✗${NC}  %s\n" "${_spinner_msg:-failed}"
}

warn() {
    printf "  ${YELLOW}⚡${NC}  %s\n" "$1"
}

fail() {
    printf "  ${RED}${BOLD}✗${NC}  %s\n" "$1" >&2
    exit 1
}

require_command() {
    command -v "$1" >/dev/null 2>&1 || fail "$1 is not installed. Please install it first."
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

detect_local_ips() {
    local ips=""
    if command -v ip >/dev/null 2>&1; then
        ips=$(ip -4 addr show 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1' | head -5)
    elif command -v ifconfig >/dev/null 2>&1; then
        ips=$(ifconfig 2>/dev/null | grep -oE 'inet [0-9]+(\.[0-9]+){3}' | grep -v '127.0.0.1' | awk '{print $2}' | head -5)
    fi
    echo "$ips"
}

confirm() {
    local prompt="$1"
    local default="${2:-n}"
    local choices=""
    if [ "$default" = "y" ]; then
        choices="[Y/n]"
    else
        choices="[y/N]"
    fi
    printf "  ${CYAN}?${NC}  %s %s " "$prompt" "$choices"
    read -r answer
    answer="${answer:-$default}"
    case "$answer" in
        y|Y|yes|YES) return 0 ;;
        *) return 1 ;;
    esac
}

prompt_value() {
    local prompt="$1"
    local default="$2"
    printf "  ${CYAN}?${NC}  %s [default: %s]: " "$prompt" "$default"
    read -r value
    echo "${value:-$default}"
}

usage() {
    banner
    cat <<EOF
  ${BOLD}Usage:${NC} $0 [OPTIONS]

  ${BOLD}Install Nodi file manager via Docker Compose.${NC}

  ${BOLD}Options:${NC}
    -d, --dir DIR         Installation directory (default: ./nodi-app)
    -p, --port PORT       Host port to expose (default: 7319)
    -H, --host HOST       Bind address (default: 0.0.0.0)
    -i, --image IMAGE     Docker image (default: ghcr.io/twarga/nodi:latest)
    -u, --user USER       Admin username (default: admin)
        --build           Build from source instead of pulling image
        --interactive     Interactive setup with prompts
        --no-pull         Skip pulling image (use local)
        --dry-run         Show what would be done without executing
        --uninstall       Remove Nodi installation
        --update          Pull latest image and restart
    -h, --help            Show this help message

  ${BOLD}Environment Variables:${NC}
    NODI_IMAGE            Docker image
    NODI_HOST             Bind address
    NODI_PORT             Host port
    NODI_USER             Admin username
    NODI_PASS_HASH        Bcrypt password hash
    NODI_COOKIE_SECRET    Session cookie secret
    NODI_MAX_UPLOAD       Max upload size in bytes

  ${BOLD}Examples:${NC}
    $0                              # Quick install with defaults
    $0 --interactive                # Guided setup with prompts
    $0 -d /opt/nodi -p 8080        # Custom directory and port
    $0 --update                     # Update to latest version
    $0 --uninstall                  # Remove installation

EOF
}

ACTION="install"

while [[ $# -gt 0 ]]; do
    case "$1" in
        -d|--dir) INSTALL_DIR="$2"; shift 2 ;;
        -p|--port) PORT="$2"; shift 2 ;;
        -H|--host) HOST="$2"; shift 2 ;;
        -i|--image) IMAGE="$2"; shift 2 ;;
        -u|--user) USER_NAME="$2"; shift 2 ;;
        --interactive) INTERACTIVE=true; shift ;;
        --build) BUILD=true; shift ;;
        --no-pull) NO_PULL=true; shift ;;
        --dry-run) DRY_RUN=true; shift ;;
        --uninstall) ACTION="uninstall"; shift ;;
        --update) ACTION="update"; shift ;;
        -h|--help) usage; exit 0 ;;
        *) fail "Unknown option: $1. Use --help for usage." ;;
    esac
done

require_command docker
COMPOSE="$(compose_cmd)"

if ! docker info >/dev/null 2>&1; then
    fail "Docker daemon is not running. Start Docker and try again."
fi

# ── Uninstall ────────────────────────────────────────────────────────────────

if [[ "$ACTION" == "uninstall" ]]; then
    banner
    if [ ! -d "$INSTALL_DIR" ]; then
        fail "Installation directory not found: $INSTALL_DIR"
    fi
    printf "  ${RED}${BOLD}This will remove Nodi and all its data.${NC}\n\n"
    if ! confirm "Are you sure you want to uninstall Nodi?" "n"; then
        printf "  Aborted.\n"
        exit 0
    fi

    printf "\n"
    step_start "Stopping containers"
    (cd "$INSTALL_DIR" && $COMPOSE down -v --remove-orphans 2>/dev/null || true) >/dev/null 2>&1
    step_done

    step_start "Removing installation directory"
    rm -rf "$INSTALL_DIR"
    step_done

    printf "\n  ${GREEN}${BOLD}Nodi has been uninstalled.${NC}\n\n"
    exit 0
fi

# ── Update ───────────────────────────────────────────────────────────────────

if [[ "$ACTION" == "update" ]]; then
    banner
    if [ ! -d "$INSTALL_DIR" ]; then
        fail "Installation directory not found: $INSTALL_DIR"
    fi

    step_start "Pulling latest image"
    (cd "$INSTALL_DIR" && $COMPOSE pull) >/dev/null 2>&1
    step_done

    step_start "Restarting containers"
    (cd "$INSTALL_DIR" && $COMPOSE up -d) >/dev/null 2>&1
    step_done

    printf "\n  ${GREEN}${BOLD}Nodi updated to ${IMAGE}${NC}\n\n"
    exit 0
fi

# ── Install ──────────────────────────────────────────────────────────────────

banner

if [ "$INTERACTIVE" = true ]; then
    printf "  ${BOLD}${UNDERLINE}Interactive Setup${NC}\n\n"

    INSTALL_DIR=$(prompt_value "Installation directory" "$INSTALL_DIR")
    PORT=$(prompt_value "Port" "$PORT")
    HOST=$(prompt_value "Bind address" "$HOST")
    USER_NAME=$(prompt_value "Admin username" "$USER_NAME")

    if confirm "Set a custom password?" "n"; then
        printf "  ${CYAN}?${NC}  Enter new password: "
        read -rs NEW_PASS
        printf "\n"
        if command -v htpasswd >/dev/null 2>&1; then
            PASSWORD_HASH=$(htpasswd -nbBC 10 "" "$NEW_PASS" | tr -d ':\n' | sed 's/^//')
        elif command -v python3 >/dev/null 2>&1; then
            PASSWORD_HASH=$(python3 -c "import bcrypt; print(bcrypt.hashpw(b'$NEW_PASS', bcrypt.gensalt(10)).decode())")
        else
            warn "Cannot hash password (no htpasswd or python3+bcrypt). Using default 'admin' password."
        fi
    fi

    printf "\n"
fi

printf "  ${BOLD}${UNDERLINE}Configuration${NC}\n\n"
printf "  %-20s %s\n" "Install directory:" "$INSTALL_DIR"
printf "  %-20s %s\n" "Docker image:" "$IMAGE"
printf "  %-20s %s\n" "Bind address:" "$HOST"
printf "  %-20s %s\n" "Port:" "$PORT"
printf "  %-20s %s\n" "Admin user:" "$USER_NAME"
printf "\n"

if [ "$DRY_RUN" = true ]; then
    printf "  ${YELLOW}${BOLD}Dry run mode — no changes will be made.${NC}\n\n"
    COOKIE_SECRET="${NODI_COOKIE_SECRET:-$(random_secret)}"

    mkdir -p "$INSTALL_DIR"

    cat > "$INSTALL_DIR/nodi.env" <<EOF
QL_HOST=${HOST}
QL_PORT=7319
QL_ROOT=/nodi_files
QL_USER=${USER_NAME}
QL_PASS_HASH=${PASSWORD_HASH}
QL_COOKIE_SECRET=${COOKIE_SECRET}
QL_THEME=${NODI_THEME:-system}
QL_MAX_UPLOAD=${MAX_UPLOAD}
EOF

    if [ "$BUILD" = true ]; then
      COMPOSE_BUILD="    build: ."
    else
      COMPOSE_BUILD="    image: ${IMAGE}"
    fi
    cat > "$INSTALL_DIR/docker-compose.yml" <<EOF
services:
  ${APP_NAME}:
${COMPOSE_BUILD}
    container_name: ${APP_NAME}
    restart: unless-stopped
    ports:
      - "${PORT}:7319"
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

volumes:
  nodi-files:
EOF

    printf "  ${BOLD}nodi.env:${NC}\n"
    while IFS= read -r line; do
        case "$line" in
            QL_PASS_HASH=*|QL_COOKIE_SECRET=*) printf "    %s***\n" "${line%%=*}=" ;;
            *) printf "    %s\n" "$line" ;;
        esac
    done < "$INSTALL_DIR/nodi.env"
    printf "\n"

    printf "  ${BOLD}docker-compose.yml:${NC}\n"
    while IFS= read -r line; do
        printf "    %s\n" "$line"
    done < "$INSTALL_DIR/docker-compose.yml"
    printf "\n"

    rm -rf "$INSTALL_DIR"
    exit 0
fi

if [ "$INTERACTIVE" != true ]; then
    if ! confirm "Continue with installation?" "y"; then
        printf "  Aborted.\n"
        exit 0
    fi
    printf "\n"
fi

# Create directory
step_start "Creating installation directory"
mkdir -p "$INSTALL_DIR"
step_done

# Generate cookie secret
COOKIE_SECRET="${NODI_COOKIE_SECRET:-$(random_secret)}"

# Write env file
step_start "Writing configuration"
cat > "$INSTALL_DIR/nodi.env" <<EOF
QL_HOST=${HOST}
QL_PORT=7319
QL_ROOT=/nodi_files
QL_USER=${USER_NAME}
QL_PASS_HASH=${PASSWORD_HASH}
QL_COOKIE_SECRET=${COOKIE_SECRET}
QL_THEME=${NODI_THEME:-system}
QL_MAX_UPLOAD=${MAX_UPLOAD}
EOF

# Clone source if building
if [ "$BUILD" = true ]; then
    step_start "Cloning source code"
    if ! git clone --depth 1 https://github.com/Twarga/Nodi.git "$INSTALL_DIR/src" >/dev/null 2>&1; then
        step_fail
        fail "Could not clone repository. Check your internet connection."
    fi
    step_done
fi

# Write docker-compose.yml
step_start "Writing docker-compose.yml"
if [ "$BUILD" = true ]; then
  COMPOSE_BUILD="    build: ./src"
else
  COMPOSE_BUILD="    image: ${IMAGE}"
fi
cat > "$INSTALL_DIR/docker-compose.yml" <<EOF
services:
  ${APP_NAME}:
${COMPOSE_BUILD}
    container_name: ${APP_NAME}
    restart: unless-stopped
    ports:
      - "${PORT}:7319"
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

volumes:
  nodi-files:
EOF
step_done

# Pull image (skip if building)
if [ "$BUILD" != true ] && [ "$NO_PULL" != true ]; then
    step_start "Pulling Docker image"
    if ! (cd "$INSTALL_DIR" && $COMPOSE pull) >/dev/null 2>&1; then
        step_fail
        fail "Could not pull ${IMAGE}. Confirm the image exists and try again."
    fi
    step_done
fi

# Start containers
step_start "Starting Nodi"
if [ "$BUILD" = true ]; then
    (cd "$INSTALL_DIR" && $COMPOSE up --build -d) >/dev/null 2>&1
else
    (cd "$INSTALL_DIR" && $COMPOSE up -d) >/dev/null 2>&1
fi
step_done

# Wait for healthy
step_start "Waiting for health check"
for i in {1..30}; do
    if (cd "$INSTALL_DIR" && $COMPOSE ps 2>/dev/null) | grep -q "healthy"; then
        break
    fi
    if [ $i -eq 30 ]; then
        warn "Container not healthy after 30s. Check logs: cd $INSTALL_DIR && $COMPOSE logs"
        break
    fi
    sleep 1
done
step_done

# Show success
LOCAL_IPS=$(detect_local_ips)

printf "\n"
printf "  ${GREEN}${BOLD}╔════════════════════════════════════════╗${NC}\n"
printf "  ${GREEN}${BOLD}║${NC}  Nodi is running!                      ${GREEN}${BOLD}║${NC}\n"
printf "  ${GREEN}${BOLD}╠════════════════════════════════════════╣${NC}\n"
printf "  ${GREEN}${BOLD}║${NC}                                        ${GREEN}${BOLD}║${NC}\n"
printf "  ${GREEN}${BOLD}║${NC}  ${CYAN}Local:${NC}    http://localhost:%-12s ${GREEN}${BOLD}║${NC}\n" "$PORT"
if [ -n "$LOCAL_IPS" ]; then
    for ip in $LOCAL_IPS; do
        printf "  ${GREEN}${BOLD}║${NC}  ${CYAN}Network:${NC}  http://%-22s ${GREEN}${BOLD}║${NC}\n" "${ip}:${PORT}"
    done
fi
printf "  ${GREEN}${BOLD}║${NC}                                        ${GREEN}${BOLD}║${NC}\n"
printf "  ${GREEN}${BOLD}║${NC}  ${DIM}Config:  %-28s${NC} ${GREEN}${BOLD}║${NC}\n" "$(cd "$INSTALL_DIR" && pwd)"
printf "  ${GREEN}${BOLD}║${NC}  ${DIM}User:    %-28s${NC} ${GREEN}${BOLD}║${NC}\n" "$USER_NAME"
printf "  ${GREEN}${BOLD}║${NC}                                        ${GREEN}${BOLD}║${NC}\n"
printf "  ${GREEN}${BOLD}╚════════════════════════════════════════╝${NC}\n"

printf "\n"
warn "Default password is 'admin' — change it immediately after first login."
printf "\n"
printf "  ${BOLD}Useful commands:${NC}\n"
printf "    cd %s && %s ps\n" "$INSTALL_DIR" "$COMPOSE"
printf "    cd %s && %s logs -f\n" "$INSTALL_DIR" "$COMPOSE"
printf "    cd %s && %s down\n" "$INSTALL_DIR" "$COMPOSE"
printf "    %s --update\n" "$0"
printf "    %s --uninstall\n" "$0"
printf "\n"
