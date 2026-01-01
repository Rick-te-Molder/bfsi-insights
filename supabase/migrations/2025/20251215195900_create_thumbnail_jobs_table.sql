-- ============================================================================
-- KB-251: Create thumbnail_jobs table for tracking batch progress
-- ============================================================================
-- Enables observability and control of thumbnailing from admin UI
-- ============================================================================

CREATE TABLE thumbnail_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  total_items INTEGER NOT NULL DEFAULT 0,
  processed_items INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT, -- 'manual' for UI-triggered, 'cli' for CLI-triggered
  error_message TEXT,
  
  -- Track which items are being processed
  current_item_id UUID REFERENCES ingestion_queue(id),
  current_item_title TEXT
);

-- Index for querying active jobs
CREATE INDEX idx_thumbnail_jobs_status ON thumbnail_jobs(status) WHERE status IN ('pending', 'running');
CREATE INDEX idx_thumbnail_jobs_created ON thumbnail_jobs(created_at DESC);

-- Track individual item thumbnailing status
CREATE TABLE thumbnail_item_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES thumbnail_jobs(id) ON DELETE CASCADE,
  queue_item_id UUID REFERENCES ingestion_queue(id) ON DELETE CASCADE,
  publication_id UUID REFERENCES kb_publication(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'success', 'failed', 'skipped')),
  error_message TEXT,
  thumbnail_url TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Either queue_item_id OR publication_id must be set
  CONSTRAINT item_reference_check CHECK (
    (queue_item_id IS NOT NULL AND publication_id IS NULL) OR
    (queue_item_id IS NULL AND publication_id IS NOT NULL)
  )
);

CREATE INDEX idx_thumbnail_item_job ON thumbnail_item_status(job_id);
CREATE INDEX idx_thumbnail_item_queue ON thumbnail_item_status(queue_item_id) WHERE queue_item_id IS NOT NULL;
CREATE INDEX idx_thumbnail_item_pub ON thumbnail_item_status(publication_id) WHERE publication_id IS NOT NULL;

-- RLS policies
ALTER TABLE thumbnail_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE thumbnail_item_status ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role full access on thumbnail_jobs" ON thumbnail_jobs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on thumbnail_item_status" ON thumbnail_item_status
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated users can read
CREATE POLICY "Authenticated can read thumbnail_jobs" ON thumbnail_jobs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can read thumbnail_item_status" ON thumbnail_item_status
  FOR SELECT TO authenticated USING (true);

-- Comments
COMMENT ON TABLE thumbnail_jobs IS 'Tracks batch thumbnailing jobs for observability (KB-251)';
COMMENT ON TABLE thumbnail_item_status IS 'Tracks individual item status within a thumbnailing job (KB-251)';
