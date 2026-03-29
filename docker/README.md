# Claude Code CLI Docker Sandbox

A secure, isolated Docker container environment for running Claude Code CLI with automated permission handling. This setup allows you to run Claude Code CLI commands without interactive permission confirmation prompts, making it ideal for CI/CD pipelines, automated workflows, and development environments.

## Overview

This Docker sandbox provides:

- **Isolated Environment**: Containerized setup prevents system-wide changes
- **Automated Permissions**: Uses `--dangerously-skip-permissions` flag for non-interactive operation
- **Project Mounting**: Easy access to your project files from the host system
- **Reproducible Setup**: Consistent environment across different machines
- **Security by Isolation**: Non-root user execution and security constraints

## Security Considerations

### ⚠️ Important: Understanding `--dangerously-skip-permissions`

The `--dangerously-skip-permissions` flag **bypasses permission confirmation prompts**. This flag should only be used in:

- **Isolated containers** (like this Docker sandbox)
- **CI/CD pipelines** with controlled inputs
- **Development environments** where you trust the code being executed
- **Local automated workflows** with monitored logs

**Never use this flag with untrusted code or in shared environments!**

### Container Security Features

- Runs as non-root user (`claude:1000`)
- No new privileges allowed (`no-new-privileges:true`)
- Limited to shared volumes only
- Isolated from host network (by default)
- Resource limits enforced (CPU and memory)

## Prerequisites

- Docker (version 20.10 or higher)
- Docker Compose (version 1.29 or higher)
- Your project directory accessible locally

## Quick Start

### 1. Build the Docker Image

```bash
cd docker
docker build -t claude-code-sandbox .
```

**Expected output:**
```
[+] Building 45.2s (15/15) FINISHED
 => => naming to docker.io/library/claude-code-sandbox
```

### 2. Run the Container (Interactive)

```bash
docker run -it --rm \
  -v $(pwd)/..:/workspace \
  claude-code-sandbox
```

This opens an interactive bash shell where you can:
```bash
# Inside container
cd /workspace
claude-code analyze src/
claude-code refactor --file src/component.tsx --dangerously-skip-permissions
```

### 3. Run with Docker Compose

```bash
# From the docker directory
docker-compose up -it

# Or if you're in the project root, specify the docker directory
docker-compose -f docker/docker-compose.yml up -it
```

## Usage Examples

### Example 1: Analyze Code

```bash
docker run -it --rm \
  -v /path/to/your/project:/workspace \
  claude-code-sandbox \
  /bin/bash -c "cd /workspace && claude-code analyze src/ --dangerously-skip-permissions"
```

### Example 2: Refactor a File

```bash
docker run -it --rm \
  -v /path/to/your/project:/workspace \
  claude-code-sandbox \
  /bin/bash -c "cd /workspace && claude-code refactor --file src/main.ts --dangerously-skip-permissions"
```

### Example 3: Run in Background and Access Logs

```bash
# Start container in background
docker run -d --name claude-worker \
  -v /path/to/your/project:/workspace \
  claude-code-sandbox \
  /bin/bash -c "cd /workspace && sleep infinity"

# Execute commands
docker exec claude-worker bash -c "claude-code analyze src/ --dangerously-skip-permissions"

# View logs
docker logs claude-worker

# Clean up
docker stop claude-worker
docker rm claude-worker
```

### Example 4: Mount Multiple Directories

```bash
docker run -it --rm \
  -v /path/to/project1:/workspace/project1 \
  -v /path/to/project2:/workspace/project2 \
  claude-code-sandbox
```

### Example 5: Pass API Key (If Required)

```bash
docker run -it --rm \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  -v /path/to/your/project:/workspace \
  claude-code-sandbox
```

## Docker Compose Usage

### Environment Variables

Create a `.env` file in the docker directory:

```env
# Path to your project (absolute or relative)
PROJECT_PATH=/path/to/your/project

# API Key (if needed)
ANTHROPIC_API_KEY=sk-your-key-here
```

Then run:

```bash
docker-compose up -it
```

### Common Docker Compose Commands

```bash
# Start container (interactive)
docker-compose up -it

# Start container (background)
docker-compose up -d

# Execute command in running container
docker-compose exec claude-code claude-code analyze src/

# Stop container
docker-compose stop

# Remove container and volumes
docker-compose down

# View logs
docker-compose logs -f

# Rebuild image after Dockerfile changes
docker-compose build --no-cache
```

## Advanced Usage

### CI/CD Integration (GitHub Actions Example)

```yaml
name: Code Analysis

on: [push]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build Claude Code container
        run: docker build -t claude-code-sandbox ./docker

      - name: Analyze code
        run: |
          docker run --rm \
            -v ${{ github.workspace }}:/workspace \
            -e ANTHROPIC_API_KEY=${{ secrets.ANTHROPIC_API_KEY }} \
            claude-code-sandbox \
            /bin/bash -c "claude-code analyze src/ --dangerously-skip-permissions"
```

### GitLab CI Integration

```yaml
analyze:
  image: docker:latest
  services:
    - docker:dind
  script:
    - cd docker
    - docker build -t claude-code-sandbox .
    - docker run --rm -v $CI_PROJECT_DIR:/workspace claude-code-sandbox /bin/bash -c "cd /workspace && claude-code analyze src/ --dangerously-skip-permissions"
```

### Local Script for Batch Operations

Create `scripts/analyze-all.sh`:

```bash
#!/bin/bash

PROJECT_PATH=$1
CONTAINER_NAME="claude-code-batch"

if [ -z "$PROJECT_PATH" ]; then
    echo "Usage: $0 <project-path>"
    exit 1
fi

# Build container
docker build -t claude-code-sandbox docker/

# Run analysis
docker run --rm \
    --name $CONTAINER_NAME \
    -v "$PROJECT_PATH":/workspace \
    claude-code-sandbox \
    /bin/bash -c "cd /workspace && claude-code analyze . --dangerously-skip-permissions && echo 'Analysis complete!'"
```

Make it executable:
```bash
chmod +x scripts/analyze-all.sh
./scripts/analyze-all.sh /path/to/project
```

## Troubleshooting

### Issue: "Cannot connect to Docker daemon"

**Solution:** Make sure Docker is running
```bash
docker ps
# If it fails, start Docker
sudo systemctl start docker
```

### Issue: "Permission denied" when mounting volumes

**Solution:** Check volume path permissions
```bash
# Use absolute paths, not relative
docker run -v $(pwd):/workspace  # Good
docker run -v ./project:/workspace  # May fail

# Or use absolute path
docker run -v /home/user/project:/workspace  # Best
```

### Issue: "claude-code: command not found"

**Solution:** Rebuild the image
```bash
docker build --no-cache -t claude-code-sandbox docker/
```

### Issue: Container exits immediately

**Solution:** The default command drops to bash. If running non-interactively, ensure you provide a command:
```bash
# Wrong (exits immediately)
docker run -d claude-code-sandbox

# Correct
docker run -d claude-code-sandbox /bin/bash -c "sleep infinity"
```

### Issue: Out of memory errors

**Solution:** Increase Docker resource limits or adjust compose file
```yaml
deploy:
  resources:
    limits:
      memory: 8G  # Increase from 4G
```

## File Structure

```
docker/
├── Dockerfile          # Container definition
├── docker-compose.yml  # Docker Compose configuration
├── .dockerignore       # Files to exclude from build
└── README.md          # This file
```

## Customization

### Modify the Dockerfile

To add additional tools or dependencies:

```dockerfile
# Add custom installations before the USER line
RUN apk add --no-cache custom-tool

# Or install npm packages
RUN npm install -g additional-package
```

Then rebuild:
```bash
docker build --no-cache -t claude-code-sandbox docker/
```

### Change Node.js Version

Edit `Dockerfile`, line 6:
```dockerfile
FROM node:22-lts-alpine  # Change 20 to 22
```

### Add More Environment Variables

In `docker-compose.yml`, add to the `environment` section:
```yaml
environment:
  CUSTOM_VAR: 'value'
  DEBUG: 'true'
```

## Performance Tips

1. **Use `.dockerignore`**: Already configured to exclude unnecessary files
2. **Cache volumes**: Mount npm cache to avoid reinstalls
3. **Build once, run many times**: Build the image once, reuse for multiple commands
4. **Use docker-compose**: Simpler management for repeated runs

## Cleanup

```bash
# Remove stopped containers
docker container prune

# Remove unused images
docker image prune

# Remove unused volumes
docker volume prune

# Full cleanup (careful!)
docker system prune -a
```

## FAQ

**Q: Can I use this for production?**
A: No. This sandbox is designed for development, testing, and CI/CD. For production use of Claude Code, follow Anthropic's production guidelines.

**Q: Is `--dangerously-skip-permissions` safe here?**
A: Yes, when used in this isolated container with trusted code. The isolation prevents any systemic damage from automated operations.

**Q: Can I access the container from outside?**
A: By default, no. The container is isolated. You can mount volumes and execute commands via `docker exec`.

**Q: How do I persist data?**
A: Mount volumes. Changes in `/workspace` are saved to your host machine automatically.

**Q: Can I run multiple containers simultaneously?**
A: Yes. Use different container names and volume mounts:
```bash
docker run --name claude-1 -v /project1:/workspace -d claude-code-sandbox
docker run --name claude-2 -v /project2:/workspace -d claude-code-sandbox
```

## Support

For issues with Claude Code CLI, see: https://github.com/anthropics/claude-code
For Docker support, see: https://docs.docker.com/

## License

This Docker setup follows the same license as the Strabismus Measurement App project.
