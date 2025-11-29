-- Add 'summarized' and 'tagged' statuses to ingestion_queue
-- Full pipeline: pending → fetched → filtered → summarized → tagged → enriched → approved/rejected

ALTER TABLE ingestion_queue 
DROP CONSTRAINT IF EXISTS ingestion_queue_status_check;

ALTER TABLE ingestion_queue
ADD CONSTRAINT ingestion_queue_status_check 
CHECK (status IN (
  'pending',     -- Initial state (discovered)
  'fetched',     -- Content retrieved
  'filtered',    -- Passed relevance check
  'summarized',  -- AI summary generated
  'tagged',      -- Taxonomy tags applied
  'enriched',    -- Thumbnail generated, ready for review
  'approved',    -- Published
  'rejected'     -- Not relevant / rejected
));

COMMENT ON COLUMN ingestion_queue.status IS 
  'Pipeline status: pending → fetched → filtered → summarized → tagged → enriched → approved/rejected';
