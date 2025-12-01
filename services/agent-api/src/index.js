import 'dotenv/config';
import process from 'node:process';
import express from 'express';
import agentRoutes from './routes/agents.js';
import { requireApiKey } from './middleware/auth.js';

const app = express();
const port = process.env.PORT || 3000;

// Security: disable X-Powered-By header to hide Express fingerprint
app.disable('x-powered-by');

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

// Apply API key auth to all agent routes
app.use('/api/agents', requireApiKey, agentRoutes);

app.listen(port, () => {
  console.log(`🤖 Agent API running on port ${port}`);
  console.log(`   Health: http://localhost:${port}/health`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
});
