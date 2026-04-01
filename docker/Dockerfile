# Claude Code CLI Sandbox Container
# This Dockerfile creates an isolated environment for running Claude Code CLI
# with the --dangerously-skip-permissions flag for automated workflows

FROM node:20-alpine

LABEL maintainer="Strabismus Measurement App"
LABEL description="Docker sandbox for Claude Code CLI with automated permissions"

# Set working directory
WORKDIR /workspace

# Install system dependencies
RUN apk add --no-cache \
    git \
    curl \
    bash \
    openssh-client \
    tar \
    gzip \
    build-base \
    python3 \
    ca-certificates \
    vim

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Create a non-root user for security
#RUN addgroup -g 1001 claude && \
#    adduser -D -u 1001 -G claude claude

# Set environment variables for automated operations
# These enable Claude Code CLI to run without permission prompts
ENV CLAUDE_CODE_SKIP_PERMISSIONS=true
ENV NODE_ENV=production
ENV HOME=/home/node

# Create home directory for the non-root user
#RUN mkdir -p /home/claude && \
#    chown -R claude:claude /home/claude

# Switch to non-root user
USER node

# Create project volume mount point
VOLUME /workspace

# Set the entrypoint to sh (more reliable in Alpine)
# Users can override this to run specific commands
ENTRYPOINT ["/bin/sh"]

# Default command
CMD ["-c", "echo 'Claude Code CLI Sandbox Container' && echo 'Run: claude-code <command> --dangerously-skip-permissions' && /bin/sh"]
