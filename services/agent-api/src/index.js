import 'dotenv/config';
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import agentRoutes from './routes/agents.js';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Init Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'bfsi-agent-api' });
});

// Register Routes
app.use('/api/agents', agentRoutes);

app.listen(port, () => {
  console.log(`🤖 Agent API running on port ${port}`);
});