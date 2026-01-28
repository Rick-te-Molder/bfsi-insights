-- ============================================================================
-- Backfill Raw Storage - Query to Identify Items
-- ============================================================================
-- This query identifies items that need raw content backfilled, prioritized by value

-- 1. Published items (highest priority) - these are live on your site
SELECT 
  iq.id,
  iq.url,
  iq.status_code,
  sl.name as status_name,
  iq.discovered_at,
  'Tier 1: Published' as priority
FROM ingestion_queue iq
JOIN status_lookup sl ON iq.status_code = sl.code
WHERE iq.raw_ref IS NULL
  AND iq.status_code = 400
ORDER BY iq.discovered_at DESC
LIMIT 150;

-- 2. Review/Approved items (high priority) - about to be published
SELECT 
  iq.id,
  iq.url,
  iq.status_code,
  sl.name as status_name,
  iq.discovered_at,
  'Tier 2: Review' as priority
FROM ingestion_queue iq
JOIN status_lookup sl ON iq.status_code = sl.code
WHERE iq.raw_ref IS NULL
  AND iq.status_code >= 300
  AND iq.status_code < 400
ORDER BY iq.discovered_at DESC
LIMIT 50;

-- 3. Summary of items needing backfill by tier
SELECT 
  CASE 
    WHEN iq.status_code = 400 THEN 'Tier 1: Published (Priority 1)'
    WHEN iq.status_code >= 300 AND iq.status_code < 400 THEN 'Tier 2: Review (Priority 2)'
    WHEN iq.status_code >= 200 AND iq.status_code < 300 THEN 'Tier 3: Enriched (Priority 3)'
    ELSE 'Tier 4: Discovery (Priority 4)'
  END as tier,
  COUNT(*) as items_needing_backfill,
  ROUND(COUNT(*)::numeric * 0.5, 2) as estimated_mb_at_500kb_per_item
FROM ingestion_queue iq
WHERE iq.raw_ref IS NULL
  AND iq.status_code >= 112  -- Only items that were fetched
GROUP BY tier
ORDER BY 
  CASE 
    WHEN iq.status_code = 400 THEN 1
    WHEN iq.status_code >= 300 AND iq.status_code < 400 THEN 2
    WHEN iq.status_code >= 200 AND iq.status_code < 300 THEN 3
    ELSE 4
  END;
