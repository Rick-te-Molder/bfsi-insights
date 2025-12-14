-- ============================================================================
-- KB-237: Drop deprecated text status column from ingestion_queue
-- ============================================================================
-- Phase 2 of status field deprecation.
-- Phase 1 (KB-236) updated all code to use status_code instead of text status.
-- This migration removes the now-unused text status column.
-- ============================================================================

-- Drop the check constraint first
ALTER TABLE ingestion_queue DROP CONSTRAINT IF EXISTS ingestion_queue_status_check;

-- Drop the deprecated text status column
ALTER TABLE ingestion_queue DROP COLUMN IF EXISTS status;

-- Drop the old index on text status (replaced by idx_queue_status_code)
DROP INDEX IF EXISTS idx_queue_status;

-- Update table comment to reflect the change
COMMENT ON TABLE ingestion_queue IS 'Lightweight queue for discovery, enrichment, and review.

STATUS (KB-237):
- Use status_code (integer) exclusively - text status column has been removed
- See status_lookup table for code definitions
- Use get_status_code_counts() RPC for aggregated status counts

RETENTION POLICY (KB-235):
- Items with terminal status older than 90 days are archived
- Run: SELECT * FROM archive_old_queue_items(90);
- Approved/published items are added to seen_urls (prevents re-discovery)
- Rejected items can be re-discovered if prompts change

INDEX STRATEGY (KB-234):
- idx_queue_status_discovered: Composite for dashboard (status_code + discovered_at DESC)
- idx_queue_payload_gin: GIN index for JSONB payload queries
- idx_queue_url_norm: UNIQUE for deduplication
- idx_queue_content_hash: UNIQUE for content deduplication';
