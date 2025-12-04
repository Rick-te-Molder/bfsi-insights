-- ============================================================================
-- Fix SECURITY DEFINER views
-- ============================================================================
-- Recreate views with explicit SECURITY INVOKER to ensure RLS policies
-- of the querying user are enforced, not the view creator.
-- ============================================================================

-- Drop and recreate v_queue_health with SECURITY INVOKER
DROP VIEW IF EXISTS v_queue_health;
CREATE VIEW v_queue_health 
WITH (security_invoker = true) AS
SELECT 
  status,
  CASE 
    WHEN discovered_at > NOW() - INTERVAL '1 day' THEN '0_last_24h'
    WHEN discovered_at > NOW() - INTERVAL '7 days' THEN '1_last_week'
    WHEN discovered_at > NOW() - INTERVAL '30 days' THEN '2_last_month'
    ELSE '3_older'
  END as age_bucket,
  COUNT(*) as count,
  MIN(discovered_at) as oldest,
  MAX(discovered_at) as newest
FROM ingestion_queue
GROUP BY status, age_bucket
ORDER BY status, age_bucket;

COMMENT ON VIEW v_queue_health IS 'Queue health summary: items by status and age bucket';

-- Drop and recreate v_queue_pending_by_source with SECURITY INVOKER
DROP VIEW IF EXISTS v_queue_pending_by_source;
CREATE VIEW v_queue_pending_by_source
WITH (security_invoker = true) AS
SELECT 
  payload->>'source' as source,
  COUNT(*) as pending_count,
  MIN(discovered_at) as oldest_pending,
  AVG(EXTRACT(EPOCH FROM (NOW() - discovered_at))/86400)::numeric(10,1) as avg_age_days
FROM ingestion_queue
WHERE status = 'pending'
GROUP BY payload->>'source'
ORDER BY pending_count DESC;

COMMENT ON VIEW v_queue_pending_by_source IS 'Pending items grouped by source to identify backlog';

-- Drop and recreate v_queue_daily_stats with SECURITY INVOKER
DROP VIEW IF EXISTS v_queue_daily_stats;
CREATE VIEW v_queue_daily_stats
WITH (security_invoker = true) AS
SELECT 
  DATE(reviewed_at) as review_date,
  status,
  COUNT(*) as count
FROM ingestion_queue
WHERE reviewed_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(reviewed_at), status
ORDER BY review_date DESC, status;

COMMENT ON VIEW v_queue_daily_stats IS 'Daily processing statistics for last 7 days';
