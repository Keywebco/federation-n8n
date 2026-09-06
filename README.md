# Federation n8n — Sovereign Automation Layer

## Purpose
This is the **NextXus Federation's automation hub** — the connective tissue between the private vault and all external systems (sites, social, newsletters, downstream services).

Self-hosted [n8n](https://n8n.io) deployed on Render as a persistent Docker web service.

## Architecture
```
┌─────────────────────┐
│  Federation Vault    │  (GitHub: Keywebco/federation-private-vault)
│  Source of Truth     │
└────────┬────────────┘
         │ webhooks / polling
         ▼
┌─────────────────────┐
│  federation-n8n      │  ← THIS SERVICE
│  Automation Hub      │  (https://federation-n8n.onrender.com)
│  Port 5678           │
└────────┬────────────┘
         │ triggers
         ▼
┌─────────────────────┐
│  External Systems    │
│  - Sites (Render)    │
│  - Social (Twitter)  │
│  - Email (Gmail)     │
│  - Gumroad           │
│  - Discord           │
│  - YouTube           │
└─────────────────────┘
```

## Access
- **URL**: https://federation-n8n.onrender.com
- **Auth**: Basic auth (federation / [master auth code])
- **API**: https://federation-n8n.onrender.com/api/v1/

## Starter Workflows
1. **Vault Heartbeat Monitor** — Polls LAST_UPDATED.md in vault every 30 min
2. **GitHub → Vault Sync Alert** — Triggers on vault push events
3. **Federation Status** — Webhook endpoint returning vault health

## Environment
- Runtime: Docker (n8nio/n8n:latest)
- Storage: Render persistent disk (1GB at /home/node/.n8n)
- Timezone: America/Chicago (CDT)
- Diagnostics: Disabled (sovereign, no telemetry)

## Deployment
Auto-deploys from this repo's `main` branch via Render.

## Notes
- Ephemeral storage fallback: If Render disk is unavailable on free tier, workflows persist in memory only and must be re-created after restart.
- Encryption key stored securely — never commit to repo.
- This is a Federation-sovereign service. No external telemetry, no third-party tracking.
