# Docker Sandbox Setup - File Manifest

This directory contains all files needed to run Claude Code CLI in an isolated Docker sandbox environment with automated permission handling.

## File Overview

### Core Docker Files

#### `Dockerfile`
- **Purpose**: Container image definition
- **Key Features**:
  - Node.js 20 LTS Alpine base image (lightweight)
  - Claude Code CLI pre-installed globally
  - Non-root user setup for security
  - Environment variables for automated operation
  - VOLUME mount at `/workspace` for project files

#### `docker-compose.yml`
- **Purpose**: Simplified multi-container orchestration
- **Key Features**:
  - Service definition for `claude-code` container
  - Volume mounting for projects
  - Environment variable management
  - Resource limits (CPU and memory)
  - Security options configured
  - Easy scaling and management

#### `.dockerignore`
- **Purpose**: Exclude files from Docker build context
- **Includes**:
  - Node modules and caches
  - Git and IDE files
  - Build artifacts
  - Documentation (optional)
  - Reduces build size and improves security

### Helper Scripts

#### `build.sh` (executable)
- **Purpose**: Simplified Docker image building
- **Features**:
  - Validates Docker installation and daemon
  - Colored output for clarity
  - Support for `--no-cache` flag
  - Helpful next steps guidance
- **Usage**: `./build.sh [--no-cache]`

#### `run.sh` (executable)
- **Purpose**: Simplified container execution
- **Features**:
  - Interactive and background modes
  - Custom container naming
  - Multiple volume support
  - Automatic image building if needed
  - Helpful logs and management tips
- **Usage**: `./run.sh [OPTIONS] [COMMAND]`

### Configuration & Examples

#### `.env.example`
- **Purpose**: Environment variable template
- **Contains**:
  - All configurable settings with explanations
  - API key placeholder
  - Path and proxy configuration
  - Docker resource settings
- **Usage**: Copy to `.env` and customize values

#### `QUICKSTART.md`
- **Purpose**: Get started in 5 minutes
- **Sections**:
  - Prerequisites checklist
  - 3-step setup process
  - Common tasks with examples
  - Basic troubleshooting
  - Next steps for advanced usage
- **Audience**: New users

#### `README.md` (Comprehensive)
- **Purpose**: Complete documentation
- **Sections**:
  - Overview and security considerations
  - Prerequisites and installation
  - Basic usage and quick start
  - Detailed usage examples
  - Docker Compose commands
  - Advanced usage (CI/CD, scripts, etc.)
  - Troubleshooting guide
  - Customization options
  - Performance tips
  - FAQ

#### `EXAMPLES.md` (Advanced)
- **Purpose**: Real-world usage scenarios
- **Covers**:
  - Basic usage patterns
  - Code analysis examples
  - Code refactoring examples
  - Batch operations
  - CI/CD integration (GitHub Actions, GitLab CI)
  - Advanced scenarios (live reload, pre-commit hooks, cron jobs)
  - Best practices and tips

#### `MANIFEST.md`
- **Purpose**: This file - provides overview of all files and their purposes

## Directory Structure

```
docker/
├── Dockerfile              # Container definition
├── docker-compose.yml      # Compose configuration
├── .dockerignore          # Build exclusions
├── build.sh               # Build automation script (executable)
├── run.sh                 # Run automation script (executable)
├── .env.example           # Configuration template
├── MANIFEST.md            # This file
├── QUICKSTART.md          # 5-minute setup guide
├── README.md              # Complete documentation
└── EXAMPLES.md            # Usage examples & advanced scenarios
```

## Quick Reference

### Building the Image

```bash
# Basic build
./build.sh

# Build without cache (fresh build)
./build.sh --no-cache
```

### Running the Container

```bash
# Interactive shell
./run.sh -i

# Run specific command
./run.sh "claude-code analyze src/"

# Background execution
./run.sh -d "command"

# With Docker Compose
docker-compose up -it
```

### Common Commands Inside Container

```bash
# Code analysis
claude-code analyze src/ --dangerously-skip-permissions

# Code refactoring
claude-code refactor --file src/main.tsx --dangerously-skip-permissions

# Help
claude-code --help
```

## Security Information

### Isolation Features

1. **Container Sandbox**: Application runs isolated from host system
2. **Non-root User**: Container runs as `claude:1000`, not root
3. **Security Options**: `no-new-privileges` enforced
4. **Volume Restrictions**: Access limited to mounted volumes
5. **Resource Limits**: CPU and memory constraints applied

### About `--dangerously-skip-permissions`

- **What it does**: Removes interactive permission prompts from Claude Code CLI
- **When it's safe**: Only in isolated containers with trusted code
- **Why needed**: Enables automation without manual confirmation
- **Risks**: Can execute potentially dangerous operations without prompting
- **Mitigation**: Isolated container environment provides safety boundary

### Best Practices

1. Always build from official sources
2. Review Dockerfile before building
3. Use specific image tags (not `latest`)
4. Mount volumes as read-only when possible
5. Check logs regularly for suspicious activity
6. Update image regularly (`docker build --no-cache`)

## File Sizes and Build Time

| Component | Size | Notes |
|-----------|------|-------|
| Dockerfile | ~1.4 KB | Small, optimized |
| docker-compose.yml | ~1.5 KB | Standard config |
| Build image | ~200-300 MB | Node.js 20 LTS with Claude Code |
| Build time | 2-3 min | First build, varies with network |
| Build time (cached) | 5-10 sec | Subsequent builds |

## What's Included in Container

- Node.js 20 LTS
- Claude Code CLI (latest)
- Git client
- cURL
- Bash
- SSH client
- Build tools
- Python 3
- CA certificates

## What's NOT Included

- Docker (can't run Docker inside Docker without special setup)
- GUI applications (headless only)
- Databases (would need separate services)
- Development IDEs (use your host IDE)

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| CLAUDE_CODE_SKIP_PERMISSIONS | true | Enable automated mode |
| NODE_ENV | production | Optimize Node.js |
| HOME | /home/claude | Home directory for user |

## Mounting Points

| Path | Purpose | Read/Write |
|------|---------|-----------|
| /workspace | Project root | Read/Write |
| /home/claude | User home | Read/Write |
| ~/.ssh | SSH keys (optional) | Read-only |

## Next Steps

1. **First Time**: Read [QUICKSTART.md](QUICKSTART.md)
2. **Full Details**: Read [README.md](README.md)
3. **Advanced Usage**: Check [EXAMPLES.md](EXAMPLES.md)
4. **Build**: Run `./build.sh`
5. **Test**: Run `./run.sh -i`

## Support and Resources

- Claude Code Documentation: https://github.com/anthropics/claude-code
- Docker Documentation: https://docs.docker.com/
- Docker Compose Guide: https://docs.docker.com/compose/
- Best Practices: https://docs.docker.com/develop/dev-best-practices/

## Version Information

- Created: 2026-03-25
- Docker Version: 20.10+
- Node.js Version: 20 LTS
- Alpine Linux: 3.19
- Claude Code CLI: Latest

## Maintenance

### Updating the Image

```bash
# Pull latest base image
docker pull node:20-lts-alpine

# Rebuild
./build.sh --no-cache

# Verify
docker images claude-code-sandbox
```

### Cleaning Up

```bash
# Remove old images
docker image prune -a

# Remove dangling volumes
docker volume prune

# Full cleanup
docker system prune -a --volumes
```

## Troubleshooting Guide

See [README.md#troubleshooting](README.md#troubleshooting) for common issues and solutions.

---

**Last Updated**: 2026-03-25
**Status**: Production Ready
