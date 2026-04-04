# Claude Code CLI Sandbox Container
# This Dockerfile creates an isolated environment for running Claude Code CLI
# with the --dangerously-skip-permissions flag for automated workflows

FROM node:20-bookworm-slim

LABEL maintainer="Strabismus Measurement App"
LABEL description="Docker sandbox for Claude Code CLI with automated permissions"

# Set working directory
WORKDIR /workspace

# Install system dependencies for Playwright and Claude Code
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    bash \
    openssh-client \
    tar \
    gzip \
    build-essential \
    python3 \
    ca-certificates \
    vim \
    readline-common \
    libreadline8 \
    libx11-6 \
    libxrender1 \
    libxext6 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libpango-1.0-0 \
    libcairo2 \
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    dbus \
    libgconf-2-4 \
    libasound2 \
    fonts-liberation \
    libxss1 \
    libxtst6 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Install Playwright globally
RUN npm install -g playwright

# Install Playwright browser (Chromium only to minimize image size)
RUN npx playwright install chromium

# Create a non-root user for security
#RUN addgroup -g 1001 claude && \
#    adduser -D -u 1001 -G claude claude

# Set environment variables for automated operations
# These enable Claude Code CLI to run without permission prompts
ENV CLAUDE_CODE_SKIP_PERMISSIONS=true
ENV NODE_ENV=production
ENV HOME=/home/node
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=false
ENV PLAYWRIGHT_BROWSERS_PATH=/usr/local/lib/node_modules/playwright/.browsers
ENV TERM=xterm-256color

# Create home directory for the non-root user
#RUN mkdir -p /home/claude && \
#    chown -R claude:claude /home/claude

# Switch to non-root user
USER node

# Ensure ~/.local/bin is in PATH for claude binary
ENV PATH=$HOME/.local/bin:$PATH

# Install Claude Code CLI using official installer
RUN curl -fsSL https://claude.ai/install.sh | bash
#RUN claude plugin install superpowers@claude-plugins-official && \
#    claude plugin install playwright@claude-plugins-official

# Create project volume mount point
VOLUME /workspace

# Set the entrypoint to bash for proper terminal support
# Users can override this to run specific commands
ENTRYPOINT ["/bin/bash"]

# Default command
CMD ["-c", "echo 'Claude Code CLI Sandbox Container' && echo 'Run: claude <command> --dangerously-skip-permissions' && /bin/bash"]
