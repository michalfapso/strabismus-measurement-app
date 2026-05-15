# Quick Start Guide

Get up and running with Claude Code CLI Docker sandbox in 5 minutes.

## Prerequisites

- Docker installed (version 20.10+)
- Docker Compose installed (version 1.29+)
- ~500MB free disk space

## Step 1: Build the Image (One-time setup)

```bash
cd /home/miso/projects/strabismus-measurement-app/docker
./build.sh
```

**What this does:**
- Builds a Docker image named `claude-code-sandbox`
- Takes about 2-3 minutes on first run
- Creates a complete Node.js environment with Claude Code CLI

**Expected output:**
```
[+] Building 45.2s (15/15) FINISHED
 => naming to docker.io/library/claude-code-sandbox
```

## Step 2: Run the Container

### Option A: Using Helper Script (Recommended)

```bash
cd /home/miso/projects/strabismus-measurement-app
./docker/run.sh -i
```

This opens an interactive bash shell in the container with your project mounted.

### Option B: Using Docker Compose

```bash
cd /home/miso/projects/strabismus-measurement-app/docker
docker-compose up -it
```

### Option C: Manual Docker Command

```bash
docker run -it --rm \
  -v ~/.claude-docker:/home/node/.claude \
  -v ~/.claude-docker.json:/home/node/.claude.json \
  -v .:/workspace \
  claude-code-sandbox
```

## Step 3: Use Claude Code CLI

Once inside the container, you can run Claude Code commands:

```bash
# Navigate to your project
cd /workspace

# Analyze code
claude-code analyze src/ --dangerously-skip-permissions

# Refactor a file
claude-code refactor --file src/main.tsx --dangerously-skip-permissions

# Help
claude-code --help
```

## Common Tasks

### Run Analysis Without Interactive Shell

```bash
docker run --rm \
  -v /home/miso/projects/strabismus-measurement-app:/workspace \
  claude-code-sandbox \
  /bin/bash -c "cd /workspace && claude-code analyze src/ --dangerously-skip-permissions"
```

### Save Analysis Results

```bash
docker run --rm \
  -v /home/miso/projects/strabismus-measurement-app:/workspace \
  claude-code-sandbox \
  /bin/bash -c "cd /workspace && claude-code analyze src/ --dangerously-skip-permissions" > analysis-report.txt
```

### Run in Background

```bash
# Start container
docker run -d --name claude-worker \
  -v /home/miso/projects/strabismus-measurement-app:/workspace \
  claude-code-sandbox \
  /bin/bash -c "sleep infinity"

# Execute commands
docker exec claude-worker bash -c "cd /workspace && claude-code analyze src/ --dangerously-skip-permissions"

# Stop when done
docker stop claude-worker
docker rm claude-worker
```

## Troubleshooting

### "Docker daemon is not running"

```bash
# Start Docker
sudo systemctl start docker  # Linux
open /Applications/Docker.app  # macOS
```

### "Image not found"

```bash
# Rebuild the image
./docker/build.sh
```

### "Permission denied"

```bash
# Make scripts executable
chmod +x /home/miso/projects/strabismus-measurement-app/docker/*.sh
```

### "Out of memory"

Edit `docker-compose.yml` and increase memory limits:
```yaml
deploy:
  resources:
    limits:
      memory: 8G  # Increase from 4G
```

## Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Check [EXAMPLES.md](EXAMPLES.md) for advanced usage scenarios
- Set up CI/CD integration using GitHub Actions or GitLab CI examples

## Cleanup

When you're done:

```bash
# Stop all running containers
docker stop $(docker ps -q)

# Remove all stopped containers
docker container prune

# Remove unused images
docker image prune

# Free up disk space
docker system prune -a
```

## Support

For more information, see:
- [README.md](README.md) - Full documentation
- [EXAMPLES.md](EXAMPLES.md) - Usage examples and advanced scenarios
- [Claude Code Documentation](https://github.com/anthropics/claude-code)
- [Docker Documentation](https://docs.docker.com/)
