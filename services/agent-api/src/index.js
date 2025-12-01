import 'dotenv/config';
import process from 'node:process';
import express from 'express';
import agentRoutes from './routes/agents.js';
import { requireApiKey } from './middleware/auth.js';

const app = express();
const port = process.env.PORT || 3000;

// Security: disable X-Powered-By header to hide Express fingerprint
app.disable('x-powered-by');

// CORS for frontend requests
app.use((req, res, next) => {
  const allowedOrigins = [
    'https://bfsiinsights.com',
    'https://www.bfsiinsights.com',
    'http://localhost:4321',
  ];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'bfsi-agent-api',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

// Trigger build (no auth - just triggers Cloudflare rebuild)
app.post('/api/trigger-build', async (req, res) => {
  try {
    const webhookUrl = process.env.CLOUDFLARE_DEPLOY_HOOK;
    if (!webhookUrl) {
      return res.status(500).json({ ok: false, message: 'CLOUDFLARE_DEPLOY_HOOK not configured' });
    }
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      return res.status(500).json({ ok: false, message: 'Build hook failed' });
    }
    console.log('✅ Cloudflare build triggered');
    res.json({ ok: true, message: 'Build triggered' });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// Apply API key auth to all agent routes
app.use('/api/agents', requireApiKey, agentRoutes);

app.listen(port, () => {
  console.log(`🤖 Agent API running on port ${port}`);
  console.log(`   Health: http://localhost:${port}/health`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
});
