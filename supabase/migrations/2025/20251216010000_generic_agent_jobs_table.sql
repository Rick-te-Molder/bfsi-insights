-- ============================================================================
-- KB-261: Generic agent jobs table for tracking batch processing
-- Replaces thumbnail_jobs with a generic table that works for all agents
-- ============================================================================

-- Create generic agent_jobs table
CREATE TABLE IF NOT EXISTS agent_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name text NOT NULL, -- 'summarizer', 'tagger', 'thumbnailer'
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed', 'cancelled'
  total_items integer NOT NULL DEFAULT 0,
  processed_items integer NOT NULL DEFAULT 0,
  success_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  current_item_id uuid,
  current_item_title text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text DEFAULT 'manual',
  error_message text
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_agent_jobs_agent_name ON agent_jobs(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_jobs_status ON agent_jobs(status);
CREATE INDEX IF NOT EXISTS idx_agent_jobs_created_at ON agent_jobs(created_at DESC);

-- Migrate existing thumbnail_jobs data to agent_jobs
INSERT INTO agent_jobs (
  id, agent_name, status, total_items, processed_items, 
  success_count, failed_count, current_item_id, current_item_title,
  started_at, completed_at, created_at, created_by
)
SELECT 
  id, 'thumbnailer', status, total_items, processed_items,
  success_count, failed_count, current_item_id, current_item_title,
  started_at, completed_at, created_at, created_by
FROM thumbnail_jobs
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE agent_jobs ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role can manage agent_jobs" ON agent_jobs
  FOR ALL USING (true) WITH CHECK (true);

-- Comment
COMMENT ON TABLE agent_jobs IS 'KB-261: Generic job tracking for all agent batch processing';
