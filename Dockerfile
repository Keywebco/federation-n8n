FROM n8nio/n8n:latest

USER root

# Create data directory with proper permissions
RUN mkdir -p /home/node/.n8n && chown -R node:node /home/node/.n8n

USER node

WORKDIR /home/node

# Render dynamically assigns PORT; n8n must bind to it
# The entrypoint script handles PORT via N8N_PORT
EXPOSE ${PORT:-5678}

# Start n8n using a shell wrapper so PORT is evaluated at runtime
CMD ["sh", "-c", "export N8N_PORT=${PORT:-5678} && n8n start"]
