-- ============================================================================
-- KB-277: Add queue_id FK to missed_discovery for tracking pipeline status
-- ============================================================================
-- Links missed_discovery to ingestion_queue so History tab can show
-- pipeline status (summarizing → tagging → thumbnailing → pending_review)
-- ============================================================================

-- Add queue_id column to link to ingestion_queue
ALTER TABLE missed_discovery
ADD COLUMN IF NOT EXISTS queue_id UUID REFERENCES ingestion_queue(id) ON DELETE SET NULL;

-- Create index for efficient joins
CREATE INDEX IF NOT EXISTS idx_missed_discovery_queue_id ON missed_discovery(queue_id);

-- Backfill existing records by matching URL
UPDATE missed_discovery md
SET queue_id = iq.id
FROM ingestion_queue iq
WHERE md.queue_id IS NULL
  AND md.url = iq.url;

COMMENT ON COLUMN missed_discovery.queue_id IS 'FK to ingestion_queue for tracking pipeline status of manually added articles';
