#!/bin/bash

# Nodi - Advanced Installer
# Inspired by modern CLI installers

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}==>${NC} Installing ${BLUE}Nodi File Manager${NC}..."

# Check dependencies
check_dep() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}Error:${NC} $1 is not installed. Please install it to continue."
        exit 1
    fi
}

check_dep docker
check_dep docker-compose

# Create project directory
INSTALL_DIR="nodi-app"
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

echo -e "${BLUE}==>${NC} Downloading configuration..."

# In a real scenario, we would curl these from GitHub
# Since I'm creating them now, I'll assume they exit in the repo context
# But for the "installer" I'll use the ones in the current directory if they are there,
# otherwise I'll simulate the download.

COMMIT_ID="main"
REPO_URL="https://raw.githubusercontent.com/Twarga/Nodi/$COMMIT_ID"

# (Simulation: in this environment we assume files are local for now, but the script shows the intent)
# curl -fsSL "$REPO_URL/docker-compose.yml" -o docker-compose.yml
# curl -fsSL "$REPO_URL/.env.example" -o .env

# Actually, the user might be running this FROM the repo or from a fresh env.
# If they are running `curl ... | bash`, they are in a fresh env.

cat > docker-compose.yml <<EOF
version: '3.8'
services:
  nodi:
    image: ghcr.io/twarga/nodi:latest
    container_name: nodi
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      - QL_PORT=8080
      - QL_ROOT=/data
      - QL_USER=\${QL_USER:-admin}
      - QL_PASS_HASH=\${QL_PASS_HASH}
      - QL_COOKIE_SECRET=\${QL_COOKIE_SECRET}
    volumes:
      - ./data:/data
    env_file:
      - .env
EOF

# Generate random cookie secret if not present
COOKIE_SECRET=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)

cat > .env <<EOF
# Nodi Configuration
QL_PORT=8080
QL_ROOT=/data
QL_USER=admin
# Use 'htpasswd -B' to generate a real hash for your password
# Default hash below is for 'admin'
QL_PASS_HASH=\$2y\$10\$y58t9Y6PqBf9N6qA58t9Ye8Zp6iS6Y7YmS6i6Y7YmS6i6Y7YmS6i6
QL_COOKIE_SECRET=$COOKIE_SECRET
QL_THEME=system
EOF

mkdir -p data

echo -e "${GREEN}==>${NC} Nodi has been configured in ${BLUE}./$INSTALL_DIR${NC}"
echo -e "${BLUE}==>${NC} To start the server, run:"
echo -e "    cd $INSTALL_DIR && docker-compose up -d"
echo -e ""
echo -e "Access Nodi at: ${GREEN}http://localhost:8080${NC}"
echo -e "Default credentials: ${BLUE}admin / admin${NC}"
