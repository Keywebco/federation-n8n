# Federation Automation Hub

A lightweight, sovereign automation hub for the NextXus Federation. Built as a custom Express.js service after determining n8n exceeds Render free-tier memory limits (512MB vs n8n's ~600MB+ startup).

## Architecture
- **Runtime**: Node.js 20 / Express.js
- **Memory footprint**: ~40MB (vs n8n's 600MB+)
- **Hosting**: Render free tier web service
- **Auth**: Bearer token via `FEDERATION_MASTER_AUTH_CODE`

## Built-in Workflows

### 1. Vault Heartbeat Monitor
- `GET /api/workflows/heartbeat/run` — Pings the GitHub vault, logs uptime
- Runs on internal cron every 6 hours

### 2. GitHub → Vault Sync Alert  
- `GET /api/workflows/sync-alert/run` — Checks recent vault commits, flags anomalies
- Runs on internal cron every 12 hours

### 3. Federation Status
- `GET /api/workflows/federation-status/run` — Aggregates system health across endpoints
- Runs on internal cron every 4 hours

## API Endpoints
- `GET /` — Dashboard UI
- `GET /health` — Health check
- `GET /api/workflows` — List all workflows
- `GET /api/workflows/:id/run` — Trigger a workflow manually
- `GET /api/workflows/:id/logs` — View workflow execution logs

## Environment Variables
| Variable | Required | Description |
|---|---|---|
| `PORT` | Yes | Server port (Render sets this) |
| `FEDERATION_MASTER_AUTH_CODE` | Yes | Bearer auth token |
| `GITHUB_TOKEN` | Yes | GitHub PAT for vault access |
| `VAULT_REPO` | No | Default: `Keywebco/federation-private-vault` |

## Deployment
Deployed automatically via Render on push to `main` branch of `Keywebco/federation-n8n`.
