-- KB-261: Add pipeline_run and pipeline_step_run tables
-- Foundation for workflow orchestration and traceability

-- Each enrichment attempt (initial discovery, manual add, or re-enrich)
CREATE TABLE pipeline_run (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id UUID NOT NULL REFERENCES ingestion_queue(id) ON DELETE CASCADE,
  trigger TEXT NOT NULL CHECK (trigger IN ('discovery', 'manual', 're-enrich', 'retry')),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_by TEXT -- user email or 'system'
);

-- Each step attempt within a run
CREATE TABLE pipeline_step_run (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES pipeline_run(id) ON DELETE CASCADE,
  step_name TEXT NOT NULL CHECK (step_name IN ('fetch', 'score', 'screen', 'summarize', 'tag', 'thumbnail')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'failed', 'skipped')),
  attempt INT NOT NULL DEFAULT 1,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  input_snapshot JSONB,  -- payload the step received
  output JSONB,          -- result the step produced
  error_message TEXT,
  error_signature TEXT,  -- normalized error for grouping similar failures
  
  UNIQUE(run_id, step_name, attempt)
);

-- Indexes for query performance
CREATE INDEX idx_pipeline_run_queue_id ON pipeline_run(queue_id);
CREATE INDEX idx_pipeline_run_status ON pipeline_run(status);
CREATE INDEX idx_pipeline_run_started_at ON pipeline_run(started_at DESC);

CREATE INDEX idx_pipeline_step_run_run_id ON pipeline_step_run(run_id);
CREATE INDEX idx_pipeline_step_run_step_name ON pipeline_step_run(step_name);
CREATE INDEX idx_pipeline_step_run_status ON pipeline_step_run(status);

-- Add current_run_id to ingestion_queue (KB-262 will use this)
ALTER TABLE ingestion_queue ADD COLUMN current_run_id UUID REFERENCES pipeline_run(id);
CREATE INDEX idx_ingestion_queue_current_run_id ON ingestion_queue(current_run_id);

-- Comment for documentation
COMMENT ON TABLE pipeline_run IS 'Tracks each enrichment attempt for a queue item. Created on discovery, manual add, or re-enrich.';
COMMENT ON TABLE pipeline_step_run IS 'Tracks each step execution within a pipeline run. Enables full traceability of what happened to any item.';
COMMENT ON COLUMN ingestion_queue.current_run_id IS 'Reference to the active pipeline run. Outputs are scoped to this run.';
