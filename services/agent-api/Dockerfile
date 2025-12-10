# Use Playwright's official image with browsers pre-installed
# Match version in package.json (^1.57.0)
FROM mcr.microsoft.com/playwright:v1.57.0-noble

WORKDIR /app

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
