FROM n8nio/n8n:latest

# Set working directory
WORKDIR /home/node

# n8n uses port 5678 by default
EXPOSE 5678

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5678/healthz || exit 1

# Start n8n
CMD ["n8n", "start"]
