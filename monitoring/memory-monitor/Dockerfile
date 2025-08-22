FROM node:20-alpine

# Create app user
RUN addgroup -g 1001 -S nodejs && adduser -S monitor -u 1001

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Create logs directory
RUN mkdir -p /app/logs && chown -R monitor:nodejs /app

# Switch to non-root user
USER monitor

# Expose metrics port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Start the memory monitor
CMD ["node", "index.js"]