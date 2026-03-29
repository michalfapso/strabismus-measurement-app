# Claude Code CLI Docker - Usage Examples

This document provides detailed examples for various use cases of the Claude Code CLI Docker sandbox.

## Table of Contents

1. [Basic Usage](#basic-usage)
2. [Code Analysis](#code-analysis)
3. [Code Refactoring](#code-refactoring)
4. [Batch Operations](#batch-operations)
5. [CI/CD Integration](#cicd-integration)
6. [Advanced Scenarios](#advanced-scenarios)

## Basic Usage

### Example 1: Build and Run Interactive Shell

```bash
# Navigate to project root
cd /home/miso/projects/strabismus-measurement-app

# Build the Docker image
./docker/build.sh

# Run interactive shell in container
./docker/run.sh -i
```

Inside the container:
```bash
# You're now in /workspace mounted from your project
cd src
ls -la
claude-code analyze . --dangerously-skip-permissions
```

### Example 2: Quick Analysis Without Building Locally

```bash
# If image already built
docker run -it --rm \
  -v /home/miso/projects/strabismus-measurement-app:/workspace \
  claude-code-sandbox \
  /bin/bash
```

## Code Analysis

### Example 1: Analyze TypeScript Project

```bash
docker run --rm \
  -v /home/miso/projects/strabismus-measurement-app:/workspace \
  claude-code-sandbox \
  /bin/bash -c "cd /workspace && claude-code analyze src/ --dangerously-skip-permissions"
```

### Example 2: Analyze Specific File

```bash
docker run --rm \
  -v /home/miso/projects/strabismus-measurement-app:/workspace \
  claude-code-sandbox \
  /bin/bash -c "cd /workspace && claude-code analyze src/main.tsx --dangerously-skip-permissions"
```

### Example 3: Generate Analysis Report

```bash
docker run --rm \
  -v /home/miso/projects/strabismus-measurement-app:/workspace \
  -v /tmp/reports:/reports \
  claude-code-sandbox \
  /bin/bash -c "cd /workspace && claude-code analyze src/ --dangerously-skip-permissions > /reports/analysis-$(date +%Y%m%d-%H%M%S).txt"
```

### Example 4: Analyze Multiple Projects

```bash
# Mount multiple project directories
docker run -it --rm \
  -v /home/miso/projects/project-a:/workspace/project-a \
  -v /home/miso/projects/project-b:/workspace/project-b \
  -v /home/miso/projects/project-c:/workspace/project-c \
  claude-code-sandbox \
  /bin/bash -c "
    echo 'Analyzing Project A...'
    cd /workspace/project-a && claude-code analyze src/ --dangerously-skip-permissions
    echo -e '\n---\n'
    echo 'Analyzing Project B...'
    cd /workspace/project-b && claude-code analyze src/ --dangerously-skip-permissions
    echo -e '\n---\n'
    echo 'Analyzing Project C...'
    cd /workspace/project-c && claude-code analyze src/ --dangerously-skip-permissions
  "
```

## Code Refactoring

### Example 1: Refactor Single File

```bash
docker run --rm \
  -v /home/miso/projects/strabismus-measurement-app:/workspace \
  claude-code-sandbox \
  /bin/bash -c "cd /workspace && claude-code refactor --file src/components/Main.tsx --dangerously-skip-permissions"
```

### Example 2: Refactor Directory

```bash
docker run --rm \
  -v /home/miso/projects/strabismus-measurement-app:/workspace \
  claude-code-sandbox \
  /bin/bash -c "cd /workspace && claude-code refactor --path src/components --dangerously-skip-permissions"
```

### Example 3: Refactor with Custom Output Directory

```bash
docker run --rm \
  -v /home/miso/projects/strabismus-measurement-app:/workspace \
  -v /tmp/refactored:/refactored \
  claude-code-sandbox \
  /bin/bash -c "cd /workspace && claude-code refactor --file src/main.tsx --dangerously-skip-permissions && cp -r src /refactored/"
```

### Example 4: Interactive Refactoring Session

```bash
# Use the helper script for convenience
./docker/run.sh -i

# Inside container, work interactively
cd /workspace
claude-code refactor --file src/components/CalibrationPanel.tsx --dangerously-skip-permissions
# Review changes, make edits, etc.
```

## Batch Operations

### Example 1: Process Multiple Files Sequentially

```bash
docker run --rm \
  -v /home/miso/projects/strabismus-measurement-app:/workspace \
  claude-code-sandbox \
  /bin/bash -c "
    for file in src/components/*.tsx; do
      echo \"Processing \$file...\"
      claude-code analyze \"\$file\" --dangerously-skip-permissions
      echo \"---\"
    done
  "
```

### Example 2: Background Batch Job with Logging

```bash
# Start container in background
docker run -d \
  --name claude-batch-job \
  -v /home/miso/projects/strabismus-measurement-app:/workspace \
  claude-code-sandbox \
  /bin/bash -c "
    cd /workspace
    echo 'Starting batch analysis...' >> /workspace/batch-log.txt
    date >> /workspace/batch-log.txt

    claude-code analyze src/ --dangerously-skip-permissions >> /workspace/batch-log.txt 2>&1

    echo 'Batch analysis complete!' >> /workspace/batch-log.txt
    date >> /workspace/batch-log.txt
  "

# Monitor progress
docker logs -f claude-batch-job

# When done, cleanup
docker stop claude-batch-job
docker rm claude-batch-job
cat /home/miso/projects/strabismus-measurement-app/batch-log.txt
```

### Example 3: Parallel Processing with Named Containers

```bash
# Start multiple analysis jobs in parallel
docker run -d --name analysis-1 -v /home/miso/projects/strabismus-measurement-app:/workspace claude-code-sandbox /bin/bash -c "cd /workspace && claude-code analyze src/components --dangerously-skip-permissions > /workspace/analysis-1.txt"

docker run -d --name analysis-2 -v /home/miso/projects/strabismus-measurement-app:/workspace claude-code-sandbox /bin/bash -c "cd /workspace && claude-code analyze src/utils --dangerously-skip-permissions > /workspace/analysis-2.txt"

docker run -d --name analysis-3 -v /home/miso/projects/strabismus-measurement-app:/workspace claude-code-sandbox /bin/bash -c "cd /workspace && claude-code analyze src/hooks --dangerously-skip-permissions > /workspace/analysis-3.txt"

# Wait for all to complete
docker wait analysis-1 analysis-2 analysis-3

# Combine results
cat /home/miso/projects/strabismus-measurement-app/analysis-*.txt > combined-report.txt

# Cleanup
docker rm analysis-1 analysis-2 analysis-3
```

## CI/CD Integration

### GitHub Actions Workflow

Create `.github/workflows/code-analysis.yml`:

```yaml
name: Claude Code Analysis

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  analyze:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Build Docker image
        run: docker build -t claude-code-sandbox ./docker

      - name: Run code analysis
        run: |
          docker run --rm \
            -v ${{ github.workspace }}:/workspace \
            -e ANTHROPIC_API_KEY=${{ secrets.ANTHROPIC_API_KEY }} \
            claude-code-sandbox \
            /bin/bash -c "cd /workspace && claude-code analyze src/ --dangerously-skip-permissions"

      - name: Run code quality checks
        run: |
          docker run --rm \
            -v ${{ github.workspace }}:/workspace \
            claude-code-sandbox \
            /bin/bash -c "cd /workspace && npm run lint && npm run typecheck"

      - name: Generate report
        if: always()
        run: |
          docker run --rm \
            -v ${{ github.workspace }}:/workspace \
            -v ${{ github.workspace }}/reports:/reports \
            claude-code-sandbox \
            /bin/bash -c "cd /workspace && claude-code analyze src/ --dangerously-skip-permissions > /reports/analysis.txt"

      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: analysis-report
          path: reports/
```

### GitLab CI Integration

Create `.gitlab-ci.yml`:

```yaml
stages:
  - build
  - analyze

build_docker:
  stage: build
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker build -t claude-code-sandbox ./docker
    - docker save claude-code-sandbox > /tmp/docker-image.tar
  artifacts:
    paths:
      - /tmp/docker-image.tar
    expire_in: 1 hour

analyze_code:
  stage: analyze
  image: docker:latest
  services:
    - docker:dind
  dependencies:
    - build_docker
  script:
    - docker load < /tmp/docker-image.tar
    - docker run --rm -v $CI_PROJECT_DIR:/workspace claude-code-sandbox /bin/bash -c "cd /workspace && claude-code analyze src/ --dangerously-skip-permissions"
```

## Advanced Scenarios

### Scenario 1: Development with Live Reload

```bash
# Terminal 1: Start container with mounted workspace
docker run -it \
  -v /home/miso/projects/strabismus-measurement-app:/workspace \
  claude-code-sandbox

# Terminal 2: Watch and trigger analysis on file changes
cd /home/miso/projects/strabismus-measurement-app
while inotifywait -r -e modify src/; do
  docker exec <container-id> claude-code analyze src/ --dangerously-skip-permissions
done
```

### Scenario 2: Integration with Pre-commit Hook

Create `.git/hooks/pre-commit`:

```bash
#!/bin/bash

echo "Running Claude Code analysis on staged files..."

# Get staged files
STAGED_FILES=$(git diff --cached --name-only | grep -E '\.(ts|tsx|js|jsx)$')

if [ -z "$STAGED_FILES" ]; then
  exit 0
fi

# Run docker analysis
docker run --rm \
  -v $(pwd):/workspace \
  claude-code-sandbox \
  /bin/bash -c "cd /workspace && for file in $STAGED_FILES; do claude-code analyze \$file --dangerously-skip-permissions; done"

if [ $? -ne 0 ]; then
  echo "Code analysis failed. Commit aborted."
  exit 1
fi

exit 0
```

Make it executable:
```bash
chmod +x .git/hooks/pre-commit
```

### Scenario 3: Docker Compose for Multi-Service Analysis

Create `docker-compose.override.yml` for development:

```yaml
version: '3.8'

services:
  claude-code:
    volumes:
      # Add local project source
      - ./src:/workspace/src
      - ./package.json:/workspace/package.json

    environment:
      DEBUG: 'true'
      CLAUDE_CODE_SKIP_PERMISSIONS: 'true'

    # Keep container running
    command: /bin/bash -c "while true; do sleep 3600; done"

  # Optional: Add watchtower to auto-rebuild on changes
  # watchtower:
  #   image: containrrr/watchtower
  #   volumes:
  #     - /var/run/docker.sock:/var/run/docker.sock
  #   command: --interval 30 claude-code
```

### Scenario 4: Scheduled Analysis via Cron

Create `scripts/schedule-analysis.sh`:

```bash
#!/bin/bash

# Script to run daily code analysis
# Add to crontab: 0 2 * * * /path/to/schedule-analysis.sh

PROJECT_DIR="/home/miso/projects/strabismus-measurement-app"
REPORT_DIR="$PROJECT_DIR/reports"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

mkdir -p "$REPORT_DIR"

docker run --rm \
  -v "$PROJECT_DIR":/workspace \
  -v "$REPORT_DIR":/reports \
  claude-code-sandbox \
  /bin/bash -c "
    cd /workspace
    echo 'Analysis started: $(date)' > /reports/analysis-$TIMESTAMP.txt
    claude-code analyze src/ --dangerously-skip-permissions >> /reports/analysis-$TIMESTAMP.txt 2>&1
    echo 'Analysis completed: $(date)' >> /reports/analysis-$TIMESTAMP.txt
  "

# Keep only last 30 reports
find "$REPORT_DIR" -name "analysis-*.txt" -mtime +30 -delete
```

Add to crontab:
```bash
crontab -e
# Add line: 0 2 * * * /home/miso/projects/strabismus-measurement-app/scripts/schedule-analysis.sh
```

## Tips and Best Practices

### 1. Always Use Absolute Paths

```bash
# Good
docker run -v /home/user/project:/workspace ...

# Avoid (may not work as expected)
docker run -v ./project:/workspace ...
```

### 2. Clean Up Containers Regularly

```bash
# Remove all stopped containers
docker container prune

# Remove containers matching pattern
docker ps -a --filter "name=claude" -q | xargs docker rm
```

### 3. Use Named Containers for Tracking

```bash
docker run --name analysis-$(date +%s) ...
```

### 4. Capture Output for Auditing

```bash
docker run ... --log-driver json-file \
  --log-opt max-size=10m \
  --log-opt max-file=3 ...
```

### 5. Environment Variables for Sensitive Data

```bash
# Use .env file instead of command line
docker run --env-file .env ...
```

### 6. Volume Mounting Best Practices

```bash
# Read-only source code
docker run -v /workspace/src:/src:ro ...

# Writeable output directory
docker run -v /tmp/output:/output:rw ...
```
