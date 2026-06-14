#!/bin/bash

# Claude Code CLI Docker Run Script
# Simplifies running the Claude Code sandbox container

set -e  # Exit on error

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(pwd)"
IMAGE_NAME="claude-code-sandbox"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

show_help() {
    cat << EOF
Usage: $0 [-i] [-d] [DOCKER_OPTIONS...]

Options:
  -i, --interactive    Run interactive shell (default)
  -d, --detach         Run container in background
  --help               Show this help message

All other arguments are forwarded directly to docker run (before the image name).

Examples:
  $0                              # Interactive shell
  $0 -d                           # Run in background
  $0 -p 8080:80                   # With port mapping
  $0 -p 3000:3000 -e DEBUG=true   # Multiple docker options
  $0 --network=host               # Arbitrary docker flags

EOF
}

INTERACTIVE=true
DETACH=""
EXTRA_ARGS=()

while [[ $# -gt 0 ]]; do
    case $1 in
        -i|--interactive) INTERACTIVE=true; shift ;;
        -d|--detach) INTERACTIVE=false; DETACH="-d"; shift ;;
        --help) show_help; exit 0 ;;
        *) EXTRA_ARGS+=("$1"); shift ;;
    esac
done

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Claude Code CLI Docker Runner${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Check if Docker is installed and running
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    exit 1
fi

if ! docker ps &> /dev/null; then
    echo -e "${RED}Error: Docker daemon is not running${NC}"
    exit 1
fi

# Check if image exists
if ! docker image inspect "${IMAGE_NAME}" &> /dev/null; then
    echo -e "${YELLOW}Warning: Image '${IMAGE_NAME}' not found${NC}"
    echo -e "${BLUE}Building image...${NC}"
    bash "${SCRIPT_DIR}/build.sh"
    echo ""
fi

# Read git identity from host for forwarding into container
GIT_USER_NAME="$(git config --global user.name 2>/dev/null || true)"
GIT_USER_EMAIL="$(git config --global user.email 2>/dev/null || true)"

echo -e "${BLUE}Container Configuration:${NC}"
echo "  Project Directory: $PROJECT_DIR"
echo "  Image: $IMAGE_NAME"
echo "  Interactive: $INTERACTIVE"
echo "  Mode: $([ -n "$DETACH" ] && echo 'Background' || echo 'Foreground')"
echo ""
echo "  claude --dangerously-skip-permissions"
echo ""

echo -e "${BLUE}Starting container...${NC}"
echo ""

CMD=(docker run --rm
    -e GIT_USER_NAME="$GIT_USER_NAME"
    -e GIT_USER_EMAIL="$GIT_USER_EMAIL"
    -v ~/.claude-docker:/home/node/.claude
    -v ~/.claude-docker.json:/home/node/.claude.json
    -v "$PROJECT_DIR":/workspace
    "${EXTRA_ARGS[@]}"
)

[ "$INTERACTIVE" = true ] && CMD+=(-it)
[ -n "$DETACH" ] && CMD+=("$DETACH")

CMD+=("$IMAGE_NAME")

"${CMD[@]}"

if [ -n "$DETACH" ]; then
    echo ""
    echo -e "${GREEN}✓ Container started in background${NC}"
    echo ""
fi
