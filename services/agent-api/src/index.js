import 'dotenv/config';
import process from 'node:process';
import express from 'express';
import agentRoutes from './routes/agents.js';

const app = express();
const port = process.env.PORT || 3000;

// Security: disable X-Powered-By header to hide Express fingerprint
app.disable('x-powered-by');

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'bfsi-agent-api' });
});

// Register Routes
app.use('/api/agents', agentRoutes);

app.listen(port, () => {
  console.log(`🤖 Agent API running on port ${port}`);
});
