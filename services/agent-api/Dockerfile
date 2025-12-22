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

# Copy package files
COPY package*.json ./

# Install dependencies (skip postinstall since browsers are pre-installed)
RUN npm ci --ignore-scripts

# Copy source code
COPY . .

# Expose port
EXPOSE 10000

# Start the server
CMD ["npm", "start"]
