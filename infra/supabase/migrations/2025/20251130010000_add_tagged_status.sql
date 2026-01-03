-- Add new statuses to ingestion_queue for async processing
-- Manual submissions: queued → processing → filtered → summarized → tagged → enriched
-- Nightly pipeline: pending → fetched → filtered → summarized → tagged → enriched

ALTER TABLE ingestion_queue 
DROP CONSTRAINT IF EXISTS ingestion_queue_status_check;

ALTER TABLE ingestion_queue
ADD CONSTRAINT ingestion_queue_status_check 
CHECK (status IN (
  'pending',     -- Initial state (discovered by RSS)
  'queued',      -- Ready for immediate processing (manual submissions)
  'processing',  -- Currently being processed by Agent API
  'fetched',     -- Content retrieved
  'filtered',    -- Passed relevance check
  'summarized',  -- AI summary generated
  'tagged',      -- Taxonomy tags applied
  'enriched',    -- Thumbnail generated, ready for review
  'approved',    -- Published
  'rejected',    -- Not relevant / rejected
  'failed'       -- Processing failed (can retry)
));

COMMENT ON COLUMN ingestion_queue.status IS 
  'Pipeline status: queued/pending → processing → filtered → summarized → tagged → enriched → approved/rejected';

-- Disable the old auto-process trigger (Edge Function is now just a thin enqueue layer)
-- Agent API now handles all processing via polling
DROP TRIGGER IF EXISTS on_manual_url_added ON ingestion_queue;
