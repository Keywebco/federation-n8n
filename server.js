const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cron = require('node-cron');
const https = require('https');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 10000;

// ============================================
// FEDERATION AUTOMATION HUB
// Sovereign connective tissue for NextXus
// ============================================

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- State ---
const state = {
  startedAt: new Date().toISOString(),
  lastVaultCheck: null,
  lastVaultStatus: null,
  lastVaultCommit: null,
  webhookEvents: [],
  heartbeatCount: 0,
  workflows: {}
};

// --- Auth middleware ---
function authCheck(req, res, next) {
  const authHeader = req.headers.authorization;
  const authCode = process.env.FEDERATION_AUTH_CODE;
  if (!authCode) return next(); // No auth configured, allow
  if (!authHeader) return res.status(401).json({ error: 'Authorization required' });
  const token = authHeader.replace('Bearer ', '');
  if (token !== authCode) return res.status(403).json({ error: 'Invalid auth' });
  next();
}

// --- Helper: fetch GitHub API ---
function githubFetch(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: path,
      method: 'GET',
      headers: {
        'User-Agent': 'FederationHub/1.0',
        'Accept': 'application/vnd.github+json'
      }
    };
    const ghToken = process.env.GITHUB_TOKEN;
    if (ghToken) {
      options.headers['Authorization'] = `Bearer ${ghToken}`;
    }
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, data: data }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

// ============================================
// ROUTES
// ============================================

// --- Landing page ---
app.get('/', (req, res) => {
  const uptime = Math.floor((Date.now() - new Date(state.startedAt).getTime()) / 1000);
  const hours = Math.floor(uptime / 3600);
  const mins = Math.floor((uptime % 3600) / 60);
  const secs = uptime % 60;

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Federation Hub — NextXus Automation</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0a0a0f;
      color: #c0c0c0;
      font-family: 'Courier New', monospace;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .hub {
      max-width: 700px;
      padding: 40px;
      border: 1px solid #1a3a2a;
      border-radius: 4px;
      background: #0d0d15;
    }
    h1 { color: #00ff88; font-size: 1.4em; margin-bottom: 8px; }
    .subtitle { color: #666; margin-bottom: 24px; }
    .status-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 24px 0; }
    .stat { padding: 16px; background: #111118; border: 1px solid #1a1a2a; border-radius: 4px; }
    .stat-label { font-size: 0.75em; color: #666; text-transform: uppercase; letter-spacing: 1px; }
    .stat-value { font-size: 1.3em; color: #00ff88; margin-top: 4px; }
    .endpoints { margin-top: 24px; }
    .endpoint { padding: 8px 0; border-bottom: 1px solid #1a1a2a; }
    .method { color: #00aaff; font-weight: bold; }
    .path { color: #ffaa00; }
    .desc { color: #666; font-size: 0.85em; }
    .footer { margin-top: 24px; color: #333; font-size: 0.8em; text-align: center; }
    .pulse { display: inline-block; width: 8px; height: 8px; background: #00ff88; border-radius: 50%;
             animation: pulse 2s infinite; }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
  </style>
</head>
<body>
  <div class="hub">
    <h1><span class="pulse"></span> Federation Automation Hub</h1>
    <div class="subtitle">NextXus Sovereign Workflow Engine</div>

    <div class="status-grid">
      <div class="stat">
        <div class="stat-label">Status</div>
        <div class="stat-value">ONLINE</div>
      </div>
      <div class="stat">
        <div class="stat-label">Uptime</div>
        <div class="stat-value">${hours}h ${mins}m ${secs}s</div>
      </div>
      <div class="stat">
        <div class="stat-label">Heartbeats</div>
        <div class="stat-value">${state.heartbeatCount}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Webhook Events</div>
        <div class="stat-value">${state.webhookEvents.length}</div>
      </div>
    </div>

    <div class="endpoints">
      <h2 style="color:#00aaff;font-size:1em;margin-bottom:12px;">API Endpoints</h2>
      <div class="endpoint">
        <span class="method">GET</span> <span class="path">/api/status</span>
        <div class="desc">Full hub status + vault health</div>
      </div>
      <div class="endpoint">
        <span class="method">GET</span> <span class="path">/api/heartbeat</span>
        <div class="desc">Vault heartbeat check (also runs on cron)</div>
      </div>
      <div class="endpoint">
        <span class="method">POST</span> <span class="path">/api/webhook/github</span>
        <div class="desc">GitHub webhook receiver for vault push events</div>
      </div>
      <div class="endpoint">
        <span class="method">POST</span> <span class="path">/api/webhook/incoming</span>
        <div class="desc">Generic webhook receiver for any downstream system</div>
      </div>
      <div class="endpoint">
        <span class="method">GET</span> <span class="path">/api/events</span>
        <div class="desc">Recent webhook events log</div>
      </div>
      <div class="endpoint">
        <span class="method">GET</span> <span class="path">/api/workflows</span>
        <div class="desc">Active workflow definitions</div>
      </div>
      <div class="endpoint">
        <span class="method">GET</span> <span class="path">/healthz</span>
        <div class="desc">Health check</div>
      </div>
    </div>

    <div class="footer">
      Federation Hub v1.0 — Sovereign Automation Layer<br>
      No telemetry. No tracking. No external dependencies.
    </div>
  </div>
</body>
</html>`);
});

// --- Health check ---
app.get('/healthz', (req, res) => {
  res.json({ status: 'healthy', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// --- Full status ---
app.get('/api/status', (req, res) => {
  const uptime = Math.floor((Date.now() - new Date(state.startedAt).getTime()) / 1000);
  res.json({
    hub: 'Federation Automation Hub',
    version: '1.0.0',
    status: 'online',
    uptime_seconds: uptime,
    started_at: state.startedAt,
    vault: {
      last_check: state.lastVaultCheck,
      status: state.lastVaultStatus,
      last_commit: state.lastVaultCommit
    },
    heartbeat_count: state.heartbeatCount,
    webhook_events_count: state.webhookEvents.length,
    active_workflows: Object.keys(state.workflows).length,
    memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    timestamp: new Date().toISOString()
  });
});

// --- Vault heartbeat ---
app.get('/api/heartbeat', async (req, res) => {
  try {
    const result = await githubFetch('/repos/Keywebco/federation-private-vault/commits?per_page=1');
    const commit = result.data[0];
    state.lastVaultCheck = new Date().toISOString();
    state.heartbeatCount++;

    if (result.status === 200 && commit) {
      state.lastVaultStatus = 'healthy';
      state.lastVaultCommit = {
        sha: commit.sha.substring(0, 7),
        message: commit.commit.message.substring(0, 100),
        author: commit.commit.author.name,
        date: commit.commit.author.date
      };
      res.json({
        vault: 'healthy',
        last_commit: state.lastVaultCommit,
        checked_at: state.lastVaultCheck,
        heartbeat_number: state.heartbeatCount
      });
    } else {
      state.lastVaultStatus = 'unreachable';
      res.json({ vault: 'unreachable', status_code: result.status, checked_at: state.lastVaultCheck });
    }
  } catch (err) {
    state.lastVaultStatus = 'error';
    state.lastVaultCheck = new Date().toISOString();
    res.json({ vault: 'error', error: err.message, checked_at: state.lastVaultCheck });
  }
});

// --- GitHub webhook receiver ---
app.post('/api/webhook/github', (req, res) => {
  const event = req.headers['x-github-event'] || 'unknown';
  const delivery = req.headers['x-github-delivery'] || crypto.randomUUID();

  const entry = {
    id: delivery,
    source: 'github',
    event: event,
    repo: req.body.repository ? req.body.repository.full_name : 'unknown',
    action: req.body.action || null,
    sender: req.body.sender ? req.body.sender.login : 'unknown',
    received_at: new Date().toISOString(),
    summary: ''
  };

  if (event === 'push') {
    entry.summary = `Push to ${req.body.ref || 'unknown'} by ${entry.sender}: ${(req.body.head_commit && req.body.head_commit.message) || 'no message'}`;
  } else if (event === 'pull_request') {
    entry.summary = `PR ${req.body.action}: ${req.body.pull_request ? req.body.pull_request.title : 'unknown'}`;
  } else {
    entry.summary = `${event} event from ${entry.repo}`;
  }

  state.webhookEvents.unshift(entry);
  if (state.webhookEvents.length > 100) state.webhookEvents = state.webhookEvents.slice(0, 100);

  console.log(`[WEBHOOK] ${entry.summary}`);
  res.json({ received: true, event: event, id: delivery });
});

// --- Generic incoming webhook ---
app.post('/api/webhook/incoming', (req, res) => {
  const entry = {
    id: crypto.randomUUID(),
    source: req.headers['x-source'] || 'external',
    event: 'incoming',
    received_at: new Date().toISOString(),
    payload_keys: Object.keys(req.body || {}),
    summary: `Incoming webhook from ${req.headers['x-source'] || 'unknown source'}`
  };

  state.webhookEvents.unshift(entry);
  if (state.webhookEvents.length > 100) state.webhookEvents = state.webhookEvents.slice(0, 100);

  console.log(`[WEBHOOK] ${entry.summary}`);
  res.json({ received: true, id: entry.id });
});

// --- Events log ---
app.get('/api/events', authCheck, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  res.json({
    events: state.webhookEvents.slice(0, limit),
    total: state.webhookEvents.length
  });
});

// --- Workflow definitions (read-only for now) ---
app.get('/api/workflows', (req, res) => {
  res.json({ workflows: state.workflows });
});

// ============================================
// SCHEDULED WORKFLOWS (CRON)
// ============================================

// Workflow 1: Vault Heartbeat Monitor — every 30 minutes
state.workflows['vault-heartbeat'] = {
  name: 'Vault Heartbeat Monitor',
  schedule: '*/30 * * * *',
  description: 'Polls federation-private-vault every 30 min, logs status',
  status: 'active',
  last_run: null,
  run_count: 0
};

cron.schedule('*/30 * * * *', async () => {
  try {
    const result = await githubFetch('/repos/Keywebco/federation-private-vault/commits?per_page=1');
    const commit = result.data[0];
    state.lastVaultCheck = new Date().toISOString();
    state.heartbeatCount++;

    if (result.status === 200 && commit) {
      state.lastVaultStatus = 'healthy';
      state.lastVaultCommit = {
        sha: commit.sha.substring(0, 7),
        message: commit.commit.message.substring(0, 100),
        author: commit.commit.author.name,
        date: commit.commit.author.date
      };
      console.log(`[HEARTBEAT #${state.heartbeatCount}] Vault healthy — last commit: ${state.lastVaultCommit.sha} "${state.lastVaultCommit.message}"`);
    } else {
      state.lastVaultStatus = 'unreachable';
      console.log(`[HEARTBEAT #${state.heartbeatCount}] Vault unreachable — status ${result.status}`);
    }

    state.workflows['vault-heartbeat'].last_run = state.lastVaultCheck;
    state.workflows['vault-heartbeat'].run_count++;
  } catch (err) {
    state.lastVaultStatus = 'error';
    console.log(`[HEARTBEAT ERROR] ${err.message}`);
  }
}, { timezone: 'America/Chicago' });

// Workflow 2: GitHub Vault Sync Alert — passive (webhook-triggered)
state.workflows['vault-sync-alert'] = {
  name: 'GitHub Vault Sync Alert',
  schedule: 'webhook-triggered',
  description: 'Triggered on vault push via GitHub webhook, logs the event',
  status: 'active',
  last_run: null,
  run_count: 0,
  webhook_url: '/api/webhook/github'
};

// Workflow 3: Federation Status — webhook endpoint
state.workflows['federation-status'] = {
  name: 'Federation Status',
  schedule: 'on-demand',
  description: 'Returns full vault health when called via /api/status',
  status: 'active',
  last_run: null,
  run_count: 0,
  endpoint: '/api/status'
};

// ============================================
// START
// ============================================

// Run initial heartbeat on startup
(async () => {
  try {
    const result = await githubFetch('/repos/Keywebco/federation-private-vault/commits?per_page=1');
    if (result.status === 200 && result.data[0]) {
      state.lastVaultCheck = new Date().toISOString();
      state.lastVaultStatus = 'healthy';
      state.heartbeatCount = 1;
      state.lastVaultCommit = {
        sha: result.data[0].sha.substring(0, 7),
        message: result.data[0].commit.message.substring(0, 100),
        author: result.data[0].commit.author.name,
        date: result.data[0].commit.author.date
      };
      console.log(`[STARTUP] Vault verified healthy — ${state.lastVaultCommit.sha}`);
    }
  } catch (e) {
    console.log(`[STARTUP] Vault check failed: ${e.message}`);
  }
})();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n====================================`);
  console.log(`  FEDERATION AUTOMATION HUB v1.0`);
  console.log(`  NextXus Sovereign Workflow Engine`);
  console.log(`  Listening on port ${PORT}`);
  console.log(`  Timezone: America/Chicago`);
  console.log(`====================================\n`);
  console.log(`Active Workflows:`);
  console.log(`  1. Vault Heartbeat Monitor (every 30m)`);
  console.log(`  2. GitHub Vault Sync Alert (webhook)`);
  console.log(`  3. Federation Status (on-demand)\n`);
});
