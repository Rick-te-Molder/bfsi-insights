# Use Playwright's official image with browsers pre-installed
# Match version in package.json (^1.57.0)
FROM mcr.microsoft.com/playwright:v1.57.0-noble

WORKDIR /app

# Install Python dependencies for PDF rendering
# Force rebuild: 2025-12-23
RUN apt-get update && apt-get install -y \
    poppler-utils \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install --break-system-packages pdf2image Pillow

# Install Node dependencies from the monorepo root (single lockfile)
COPY package.json package-lock.json ./
COPY services/agent-api/package.json ./services/agent-api/package.json
RUN npm ci -w services/agent-api --ignore-scripts

# Copy source code
COPY services/agent-api ./services/agent-api

# Expose port
EXPOSE 10000

# Start the server
CMD ["npm", "-w", "services/agent-api", "start"]
