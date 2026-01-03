-- ============================================================================
-- KB-237: Drop deprecated text status column from ingestion_queue
-- ============================================================================
-- Phase 2 of status field deprecation.
-- Phase 1 (KB-236) updated all code to use status_code instead of text status.
-- This migration removes the now-unused text status column.
-- ============================================================================

-- =============================================================================
-- STEP 1: Drop dependent views first
-- =============================================================================

DROP VIEW IF EXISTS ingestion_review_queue;
DROP VIEW IF EXISTS v_queue_health;
DROP VIEW IF EXISTS v_queue_pending_by_source;
DROP VIEW IF EXISTS v_queue_daily_stats;
DROP VIEW IF EXISTS ingestion_queue_with_status;

-- =============================================================================
-- STEP 2: Drop constraint, column, and index
-- =============================================================================

ALTER TABLE ingestion_queue DROP CONSTRAINT IF EXISTS ingestion_queue_status_check;
ALTER TABLE ingestion_queue DROP COLUMN IF EXISTS status;
DROP INDEX IF EXISTS idx_queue_status;

-- =============================================================================
-- STEP 3: Recreate views using status_code (via status_lookup join)
-- =============================================================================

CREATE VIEW v_queue_health 
WITH (security_invoker = true) AS
SELECT 
  sl.name as status,
  CASE 
    WHEN discovered_at > NOW() - INTERVAL '1 day' THEN '0_last_24h'
    WHEN discovered_at > NOW() - INTERVAL '7 days' THEN '1_last_week'
    WHEN discovered_at > NOW() - INTERVAL '30 days' THEN '2_last_month'
    ELSE '3_older'
  END as age_bucket,
  COUNT(*) as count,
  MIN(discovered_at) as oldest,
  MAX(discovered_at) as newest
FROM ingestion_queue q
LEFT JOIN status_lookup sl ON sl.code = q.status_code
GROUP BY sl.name, age_bucket
ORDER BY sl.name, age_bucket;

COMMENT ON VIEW v_queue_health IS 'Queue health summary: items by status and age bucket';

CREATE VIEW v_queue_pending_by_source
WITH (security_invoker = true) AS
SELECT 
  payload->>'source' as source,
  COUNT(*) as pending_count,
  MIN(discovered_at) as oldest_pending,
  AVG(EXTRACT(EPOCH FROM (NOW() - discovered_at))/86400)::numeric(10,1) as avg_age_days
FROM ingestion_queue
WHERE status_code < 300
GROUP BY payload->>'source'
ORDER BY pending_count DESC;

COMMENT ON VIEW v_queue_pending_by_source IS 'Pending items grouped by source to identify backlog';

CREATE VIEW v_queue_daily_stats
WITH (security_invoker = true) AS
SELECT 
  DATE(reviewed_at) as review_date,
  sl.name as status,
  COUNT(*) as count
FROM ingestion_queue q
LEFT JOIN status_lookup sl ON sl.code = q.status_code
WHERE reviewed_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(reviewed_at), sl.name
ORDER BY review_date DESC, sl.name;

COMMENT ON VIEW v_queue_daily_stats IS 'Daily processing statistics for last 7 days';

-- =============================================================================
-- STEP 4: Update table comment
-- =============================================================================

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
