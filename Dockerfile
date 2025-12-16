# Dockerfile
FROM node:22-alpine3.23

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install --only=production

# Copy application files
COPY . .

# Create database directory with proper permissions
RUN mkdir -p /app/data && chown -R node:node /app

# Switch to non-root user for security
USER node

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV DB_PATH=/app/data/inventory.db

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); http.get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

# Start the application
CMD ["npm", "start"]