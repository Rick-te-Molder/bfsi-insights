-- Add relevance scoring columns to ingestion_queue
-- KB-155: Agentic Discovery System - Phase 1

-- Relevance score from LLM (1-10 scale)
ALTER TABLE ingestion_queue 
ADD COLUMN IF NOT EXISTS relevance_score DECIMAL(3,1);

-- Brief executive summary of why content matters (or doesn't)
ALTER TABLE ingestion_queue 
ADD COLUMN IF NOT EXISTS executive_summary TEXT;

-- Skip reason if relevance_score < 4 (e.g., "Too academic", "Wrong industry")
ALTER TABLE ingestion_queue 
ADD COLUMN IF NOT EXISTS skip_reason TEXT;

-- Discovery metrics table for tracking agent performance
CREATE TABLE IF NOT EXISTS discovery_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source_slug TEXT REFERENCES kb_source(slug),
  
  -- Counts
  candidates_found INTEGER DEFAULT 0,
  passed_relevance INTEGER DEFAULT 0,
  auto_skipped INTEGER DEFAULT 0,
  queued INTEGER DEFAULT 0,
  
  -- Scores
  avg_relevance_score DECIMAL(3,1),
  min_relevance_score DECIMAL(3,1),
  max_relevance_score DECIMAL(3,1),
  
  -- Costs
  total_tokens_used INTEGER DEFAULT 0,
  estimated_cost_usd DECIMAL(6,4),
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for querying metrics by date and source
CREATE INDEX IF NOT EXISTS idx_discovery_metrics_date 
ON discovery_metrics(run_date DESC);

CREATE INDEX IF NOT EXISTS idx_discovery_metrics_source 
ON discovery_metrics(source_slug);

-- Add comment for documentation
COMMENT ON COLUMN ingestion_queue.relevance_score IS 
  'Executive relevance score (1-10) from discovery-relevance agent. Score >= 4 queued, < 4 skipped.';

COMMENT ON COLUMN ingestion_queue.skip_reason IS 
  'Reason for skipping if relevance_score < 4 (e.g., Too academic, Wrong industry)';

COMMENT ON TABLE discovery_metrics IS 
  'Tracks discovery agent performance: candidates found, scoring, costs per run.';
