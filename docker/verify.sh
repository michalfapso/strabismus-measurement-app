#!/bin/bash

# Docker Setup Verification Script
# Checks if the Docker environment is properly configured and ready to use

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Docker Setup Verification${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Function to check command
check_command() {
    if command -v $1 &> /dev/null; then
        echo -e "${GREEN}✓${NC} $2"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} $2"
        ((FAILED++))
        return 1
    fi
}

# Function to check file
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $2"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} $2"
        ((FAILED++))
        return 1
    fi
}

# Function to check executable
check_executable() {
    if [ -x "$1" ]; then
        echo -e "${GREEN}✓${NC} $2"
        ((PASSED++))
        return 0
    else
        echo -e "${YELLOW}⚠${NC} $2 (not executable)"
        ((WARNINGS++))
        return 1
    fi
}

# Function to run test
check_test() {
    if eval "$1" &> /dev/null; then
        echo -e "${GREEN}✓${NC} $2"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} $2"
        ((FAILED++))
        return 1
    fi
}

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo -e "${BLUE}1. Checking Required Commands${NC}"
echo "───────────────────────────────────────"
check_command docker "Docker is installed"
check_command docker-compose "Docker Compose is installed"
check_command bash "Bash is available"
echo ""

echo -e "${BLUE}2. Checking Docker System${NC}"
echo "───────────────────────────────────────"
if check_test "docker ps" "Docker daemon is running"; then
    DOCKER_VERSION=$(docker --version 2>/dev/null | awk '{print $3}' | tr -d ',')
    echo -e "${BLUE}   Docker version: $DOCKER_VERSION${NC}"
fi

if check_test "docker-compose version" "Docker Compose is working"; then
    DC_VERSION=$(docker-compose --version 2>/dev/null | awk '{print $3}' | tr -d ',')
    echo -e "${BLUE}   Docker Compose version: $DC_VERSION${NC}"
fi
echo ""

echo -e "${BLUE}3. Checking Required Files${NC}"
echo "───────────────────────────────────────"
check_file "$SCRIPT_DIR/Dockerfile" "Dockerfile exists"
check_file "$SCRIPT_DIR/docker-compose.yml" "docker-compose.yml exists"
check_file "$SCRIPT_DIR/.dockerignore" ".dockerignore exists"
check_file "$SCRIPT_DIR/README.md" "README.md exists"
check_file "$SCRIPT_DIR/EXAMPLES.md" "EXAMPLES.md exists"
check_file "$SCRIPT_DIR/QUICKSTART.md" "QUICKSTART.md exists"
check_file "$SCRIPT_DIR/MANIFEST.md" "MANIFEST.md exists"
check_file "$SCRIPT_DIR/.env.example" ".env.example exists"
echo ""

echo -e "${BLUE}4. Checking Helper Scripts${NC}"
echo "───────────────────────────────────────"
check_file "$SCRIPT_DIR/build.sh" "build.sh exists"
check_file "$SCRIPT_DIR/run.sh" "run.sh exists"
check_executable "$SCRIPT_DIR/build.sh" "build.sh is executable"
check_executable "$SCRIPT_DIR/run.sh" "run.sh is executable"
echo ""

echo -e "${BLUE}5. Checking System Resources${NC}"
echo "───────────────────────────────────────"

# Check available disk space (need at least 1GB)
DISK_FREE=$(df "$SCRIPT_DIR" | tail -1 | awk '{print $4}')
DISK_FREE_GB=$((DISK_FREE / 1024 / 1024))
if [ "$DISK_FREE_GB" -gt 1 ]; then
    echo -e "${GREEN}✓${NC} Disk space available: ${DISK_FREE_GB}GB"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠${NC} Low disk space: ${DISK_FREE_GB}GB (minimum 1GB recommended)"
    ((WARNINGS++))
fi

# Check memory (need at least 2GB)
if [ -f /proc/meminfo ]; then
    MEM_TOTAL=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    MEM_TOTAL_GB=$((MEM_TOTAL / 1024 / 1024))
    if [ "$MEM_TOTAL_GB" -gt 2 ]; then
        echo -e "${GREEN}✓${NC} System memory available: ${MEM_TOTAL_GB}GB"
        ((PASSED++))
    else
        echo -e "${YELLOW}⚠${NC} Low system memory: ${MEM_TOTAL_GB}GB (minimum 2GB recommended)"
        ((WARNINGS++))
    fi
fi

# Check CPU cores
if [ -f /proc/cpuinfo ]; then
    CPU_CORES=$(grep -c "^processor" /proc/cpuinfo)
    if [ "$CPU_CORES" -gt 0 ]; then
        echo -e "${GREEN}✓${NC} CPU cores available: $CPU_CORES"
        ((PASSED++))
    fi
fi
echo ""

echo -e "${BLUE}6. Checking Optional Configuration${NC}"
echo "───────────────────────────────────────"
if [ -f "$SCRIPT_DIR/.env" ]; then
    echo -e "${GREEN}✓${NC} .env file exists (custom configuration)"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠${NC} .env file not found (using defaults)"
    ((WARNINGS++))
fi
echo ""

echo -e "${BLUE}7. Dockerfile Validation${NC}"
echo "───────────────────────────────────────"
if check_test "docker build --dry-run -f $SCRIPT_DIR/Dockerfile $SCRIPT_DIR" "Dockerfile syntax is valid"; then
    echo -e "${BLUE}   Dockerfile is valid and ready to build${NC}"
fi
echo ""

echo -e "${BLUE}8. Docker Image Status${NC}"
echo "───────────────────────────────────────"
if docker image inspect claude-code-sandbox &> /dev/null; then
    IMAGE_SIZE=$(docker image inspect claude-code-sandbox --format='{{.Size}}' | awk '{print $1 / 1024 / 1024 " MB"}')
    IMAGE_ID=$(docker image inspect claude-code-sandbox --format='{{.ID}}' | cut -d':' -f2 | cut -c1-12)
    echo -e "${GREEN}✓${NC} Image 'claude-code-sandbox' is built"
    ((PASSED++))
    echo -e "${BLUE}   ID: $IMAGE_ID${NC}"
    echo -e "${BLUE}   Size: $IMAGE_SIZE${NC}"
else
    echo -e "${YELLOW}⚠${NC} Image 'claude-code-sandbox' not yet built"
    echo -e "   Run: ${BLUE}./build.sh${NC}"
    ((WARNINGS++))
fi
echo ""

# Summary
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Verification Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "Passed:  ${GREEN}$PASSED${NC}"
echo -e "Failed:  ${RED}$FAILED${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}✓ All checks passed! You're ready to use Claude Code CLI Docker.${NC}"
        echo ""
        echo -e "${BLUE}Next steps:${NC}"
        echo "  1. Build the image:  ./build.sh"
        echo "  2. Run container:    ./run.sh -i"
        echo "  3. Inside container: claude-code analyze src/ --dangerously-skip-permissions"
        exit 0
    else
        echo -e "${YELLOW}⚠ Verification passed with warnings.${NC}"
        echo ""
        echo -e "${BLUE}Next steps:${NC}"
        echo "  1. Address the warnings above (optional but recommended)"
        echo "  2. Build the image:  ./build.sh"
        echo "  3. Run container:    ./run.sh -i"
        exit 0
    fi
else
    echo -e "${RED}✗ Verification failed. Please address the errors above.${NC}"
    echo ""
    echo -e "${BLUE}Common fixes:${NC}"

    if ! command -v docker &> /dev/null; then
        echo "  • Install Docker: https://docs.docker.com/get-docker/"
    fi

    if ! docker ps &> /dev/null; then
        echo "  • Start Docker: sudo systemctl start docker (or open Docker Desktop)"
    fi

    if ! command -v docker-compose &> /dev/null; then
        echo "  • Install Docker Compose: https://docs.docker.com/compose/install/"
    fi

    echo "  • Check file permissions: chmod +x *.sh"
    exit 1
fi
