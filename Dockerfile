# Use Node.js LTS version
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY web/package*.json ./web/ 2>/dev/null || true

# Install dependencies
RUN npm ci

# Copy application files
COPY . .

# Build extensions if needed
RUN npm run build || true

# Expose port
EXPOSE 8080

# Start the server
CMD ["node", "web/server.js"]

