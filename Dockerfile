FROM n8nio/n8n:latest

# Render requires the app to listen on PORT (default 10000)
# Override n8n's default port via environment
ENV N8N_PORT=10000
ENV N8N_HOST=0.0.0.0
ENV N8N_PROTOCOL=https
ENV N8N_SECURE_COOKIE=false
ENV DB_TYPE=sqlite

# Expose the Render port
EXPOSE 10000

# Start n8n
CMD ["n8n", "start"]
