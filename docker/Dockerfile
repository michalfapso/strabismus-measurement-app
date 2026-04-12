# Claude Code CLI Sandbox Container with Playwright MCP
# This Dockerfile creates an isolated environment for running Claude Code CLI
# with Playwright MCP support for automated browser interactions

FROM node:20-bookworm-slim

LABEL maintainer="Strabismus Measurement App"
LABEL description="Docker sandbox for Claude Code CLI with Playwright MCP"

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

# Set environment variables
ENV NODE_ENV=production
ENV HOME=/home/node
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=false
ENV TERM=xterm-256color
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers
ENV PATH=$HOME/.local/bin:$PATH

# Create Playwright browsers directory with proper permissions (as root)
RUN mkdir -p /opt/playwright-browsers && chmod 755 /opt/playwright-browsers

# Install Playwright and Chromium browser as root (before user switch)
# This ensures browser binaries are accessible to all users
RUN npm install -g playwright && \
    npx playwright install chromium && \
    chmod -R 755 /opt/playwright-browsers && \
    npm cache clean --force && \
    rm -rf /home/node/.npm

# Switch to non-root user for Claude Code operations
USER node

# Install Claude Code CLI
RUN curl -fsSL https://claude.ai/install.sh | bash

# Create project volume mount point
VOLUME /workspace

# Set the entrypoint to bash
ENTRYPOINT ["/bin/bash"]

# Default command
CMD ["-c", "echo 'Claude Code CLI Sandbox with Playwright MCP' && /bin/bash"]
