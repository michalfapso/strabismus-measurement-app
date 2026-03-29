#!/bin/bash

# Claude Code CLI Docker Build Script
# Builds the Docker image for the Claude Code sandbox

set -e  # Exit on error

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
IMAGE_NAME="claude-code-sandbox"
IMAGE_TAG="latest"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Claude Code CLI Docker Image Builder${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Parse arguments
NO_CACHE=""
while [[ $# -gt 0 ]]; do
    case $1 in
        --no-cache)
            NO_CACHE="--no-cache"
            echo -e "${BLUE}Building without cache...${NC}"
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --no-cache    Build without using cached layers"
            echo "  --help        Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    exit 1
fi

# Check if Docker daemon is running
if ! docker ps &> /dev/null; then
    echo -e "${RED}Error: Docker daemon is not running${NC}"
    echo "Please start Docker and try again"
    exit 1
fi

echo -e "${BLUE}Building image: ${IMAGE_NAME}:${IMAGE_TAG}${NC}"
echo -e "${BLUE}Dockerfile location: ${SCRIPT_DIR}/Dockerfile${NC}"
echo ""

# Build the image
if docker build $NO_CACHE -t "${IMAGE_NAME}:${IMAGE_TAG}" -f "${SCRIPT_DIR}/Dockerfile" "${SCRIPT_DIR}"; then
    echo ""
    echo -e "${GREEN}✓ Image built successfully!${NC}"
    echo ""
    echo -e "${BLUE}Image details:${NC}"
    docker images "${IMAGE_NAME}:${IMAGE_TAG}" --no-trunc
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "  1. Run interactive container:"
    echo "     docker run -it --rm -v \$(pwd)/..:/workspace ${IMAGE_NAME}"
    echo ""
    echo "  2. Run specific command:"
    echo "     docker run --rm -v /path/to/project:/workspace ${IMAGE_NAME}"
    echo "       /bin/bash -c 'claude-code analyze src/ --dangerously-skip-permissions'"
    echo ""
    echo "  3. Use Docker Compose:"
    echo "     docker-compose -f docker-compose.yml up -it"
    echo ""
else
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi
