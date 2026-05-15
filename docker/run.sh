#!/bin/bash

# Claude Code CLI Docker Run Script
# Simplifies running the Claude Code sandbox container

set -e  # Exit on error

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
#PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_DIR="$(pwd)"
IMAGE_NAME="claude-code-sandbox"
CONTAINER_NAME="claude-code-work"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

show_help() {
    cat << EOF
Usage: $0 [OPTIONS] [COMMAND]

Options:
  -i, --interactive    Run interactive shell (default)
  -d, --detach         Run container in background
  -n, --name NAME      Custom container name (default: $CONTAINER_NAME)
  -v, --volume PATH    Additional volume mount (can be used multiple times)
  --help              Show this help message

Examples:
  # Interactive shell
  $0 -i

  # Run command without interaction
  $0 "claude-code analyze src/"

  # Run in background
  $0 -d "claude-code refactor --file src/main.ts"

  # With additional volumes
  $0 -v /data:/workspace/data "claude-code analyze src/"

EOF
}

# Parse arguments
INTERACTIVE=true
DETACH=""
VOLUMES=()
COMMAND=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -i|--interactive)
            INTERACTIVE=true
            shift
            ;;
        -d|--detach)
            INTERACTIVE=false
            DETACH="-d"
            shift
            ;;
        -n|--name)
            CONTAINER_NAME="$2"
            shift 2
            ;;
        -v|--volume)
            VOLUMES+=("-v" "$2")
            shift 2
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            COMMAND="$1"
            shift
            ;;
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

# Build docker run command
RUN_CMD="docker run"

# Add flags
RUN_CMD="$RUN_CMD --rm"
#RUN_CMD="$RUN_CMD --name $CONTAINER_NAME"
RUN_CMD="$RUN_CMD -v ~/.claude-docker:/home/node/.claude"
RUN_CMD="$RUN_CMD -v ~/.claude-docker.json:/home/node/.claude.json"
RUN_CMD="$RUN_CMD -v $PROJECT_DIR:/workspace"

# Add extra volumes if specified
for vol in "${VOLUMES[@]}"; do
    RUN_CMD="$RUN_CMD $vol"
done

# Add interactive flags if needed
if [ "$INTERACTIVE" = true ]; then
    RUN_CMD="$RUN_CMD -it"
fi

# Add detach if needed
if [ -n "$DETACH" ]; then
    RUN_CMD="$RUN_CMD $DETACH"
fi

# Add image name
RUN_CMD="$RUN_CMD $IMAGE_NAME"

# Add command if provided
if [ -n "$COMMAND" ]; then
    RUN_CMD="$RUN_CMD /bin/bash -c '$COMMAND'"
fi

echo -e "${BLUE}Container Configuration:${NC}"
echo "  Project Directory: $PROJECT_DIR"
echo "  Container Name: $CONTAINER_NAME"
echo "  Image: $IMAGE_NAME"
echo "  Interactive: $INTERACTIVE"
echo "  Mode: $([ -n "$DETACH" ] && echo 'Background' || echo 'Foreground')"
if [ -n "$COMMAND" ]; then
    echo "  Command: $COMMAND"
fi
echo ""

echo -e "${BLUE}Starting container...${NC}"
echo ""

# Run the container
eval $RUN_CMD

if [ -n "$DETACH" ]; then
    echo ""
    echo -e "${GREEN}✓ Container started in background${NC}"
    echo ""
    echo -e "${BLUE}Useful commands:${NC}"
    echo "  View logs:        docker logs -f $CONTAINER_NAME"
    echo "  Execute command:  docker exec $CONTAINER_NAME <command>"
    echo "  Stop container:   docker stop $CONTAINER_NAME"
    echo ""
fi
