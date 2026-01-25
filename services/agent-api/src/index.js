import dotenv from 'dotenv';
import './env-shim.js';
import process from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import agentRoutes from './routes/agents.js';
import agentJobRoutes from './routes/agent-jobs.js';
import jobsRoutes from './routes/jobs.js';
import discoveryControlRoutes from './routes/discovery-control.js';
import evalsRoutes from './routes/evals.js';
import { requireApiKey } from './middleware/auth.js';
import { getSupabaseAdminClient } from './clients/supabase.js';
import { syncUtilityVersionsToDb } from './lib/utility-versions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serviceRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(serviceRoot, '.env') });
dotenv.config({ path: path.join(serviceRoot, '.env.local'), override: true });

const app = express();
const port = process.env.PORT || 3000;

// Security: disable X-Powered-By header to hide Express fingerprint
app.disable('x-powered-by');

// CORS for frontend requests
app.use((/** @type {any} */ req, /** @type {any} */ res, /** @type {any} */ next) => {
  const allowedOrigins = [
    'https://bfsiinsights.com',
    'https://www.bfsiinsights.com',
    'https://admin.bfsiinsights.com',
    'http://localhost:4321',
    'http://localhost:3000',
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
app.get('/health', (/** @type {any} */ req, /** @type {any} */ res) => {
  res.json({
    status: 'ok',
    service: 'bfsi-agent-api',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

// Trigger build (no auth - just triggers Cloudflare rebuild)
app.post('/api/trigger-build', async (/** @type {any} */ req, /** @type {any} */ res) => {
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

    // Update approved items (330) to published (400)
    const supabase = getSupabaseAdminClient();
    const { data: updated, error: updateError } = await supabase
      .from('ingestion_queue')
      .update({ status_code: 400 })
      .eq('status_code', 330)
      .select('id');

    const publishedCount = updated?.length || 0;
    if (updateError) {
      console.warn('⚠️ Failed to update status codes:', updateError.message);
    } else if (publishedCount > 0) {
      console.log(`✅ Updated ${publishedCount} items from approved to published`);
    }

    console.log('✅ Cloudflare build triggered');
    res.json({ ok: true, message: 'Build triggered', publishedCount });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, message });
  }
});

// Apply API key auth to all agent routes
// Note: More specific routes must come first
app.use('/api/jobs', requireApiKey, agentJobRoutes);
app.use('/api/scheduler', requireApiKey, jobsRoutes);
app.use('/api/discovery', requireApiKey, discoveryControlRoutes);
app.use('/api/evals', requireApiKey, evalsRoutes);
app.use('/api/agents', requireApiKey, agentRoutes);

app.listen(port, () => {
  console.log(`🤖 Agent API running on port ${port}`);
  console.log(`   Health: http://localhost:${port}/health`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);

  // Best-effort sync of utility versions so Admin can read from DB.
  // Do not fail startup if env vars or table are not available.
  const hasSupabaseEnv =
    Boolean(process.env.SUPABASE_URL) &&
    (Boolean(process.env.SUPABASE_SERVICE_KEY) || Boolean(process.env.SUPABASE_ANON_KEY));

  if (!hasSupabaseEnv) {
    console.log('ℹ️ Utility version sync skipped: Missing Supabase environment variables');
    return;
  }

  syncUtilityVersionsToDb().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('⚠️ Utility version sync failed:', message);
  });
});
