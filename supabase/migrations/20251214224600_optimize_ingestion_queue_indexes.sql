-- ============================================================================
-- KB-234: Optimize ingestion_queue indexes based on DBA feedback
-- ============================================================================
-- This migration adds performance indexes for common query patterns:
-- 1. Composite index for dashboard queries (status + date ordering)
-- 2. GIN index for JSONB payload queries (source_slug filtering)
-- ============================================================================

-- ============================================================================
-- 1. Composite Index for Dashboard Queries
-- ============================================================================
-- The review dashboard always queries by status_code and orders by discovered_at.
-- A composite index eliminates the need for a separate sort operation.
--
-- Query pattern:
--   SELECT * FROM ingestion_queue 
--   WHERE status_code = 300 
--   ORDER BY discovered_at DESC LIMIT 100;
--
-- Note: This replaces the separate idx_queue_status_code index for most queries.
-- We keep both for now as some queries may only filter by status_code.

CREATE INDEX IF NOT EXISTS idx_queue_status_discovered 
ON ingestion_queue(status_code, discovered_at DESC);

-- ============================================================================
-- 2. GIN Index for JSONB Payload Queries
-- ============================================================================
-- Dashboard filters by payload->>'source_slug' which is slow without an index.
-- Using jsonb_path_ops for efficient containment queries.
--
-- Query patterns:
--   SELECT * FROM ingestion_queue WHERE payload->>'source_slug' = 'fdic';
--   SELECT * FROM ingestion_queue WHERE payload @> '{"source_slug": "fdic"}';

CREATE INDEX IF NOT EXISTS idx_queue_payload_gin 
ON ingestion_queue USING GIN (payload jsonb_path_ops);

-- ============================================================================
-- 3. Documentation
-- ============================================================================
-- Update table comment with index strategy

COMMENT ON TABLE ingestion_queue IS 'Lightweight queue for discovery, enrichment, and review.

INDEX STRATEGY (KB-234):
- idx_queue_status_discovered: Composite for dashboard (status_code + discovered_at DESC)
- idx_queue_payload_gin: GIN index for JSONB payload queries (source_slug filtering)
- idx_queue_url_norm: UNIQUE for deduplication
- idx_queue_content_hash: UNIQUE for content deduplication

FUTURE CONSIDERATIONS:
- Archive old items (>90 days) to ingestion_queue_archive table
- Deprecate text status field in favor of status_code only
- Consider partitioning by discovered_at if table exceeds 10M rows';
