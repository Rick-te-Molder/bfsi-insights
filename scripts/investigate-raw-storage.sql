-- ============================================================================
-- Investigate Raw Storage Status
-- ============================================================================
-- Find out why only 1 item has raw storage out of 2,709

-- 1. Check when raw_object table was created (from migration timestamp)
-- The table was created in migration 20260125221300_raw_object_registry.sql
-- This means raw storage was implemented on Jan 25, 2026

-- 2. Check item distribution by status and raw_ref
SELECT 
  sl.code,
  sl.name as status_name,
  COUNT(*) as total_items,
  COUNT(iq.raw_ref) as items_with_raw_ref,
  COUNT(CASE WHEN iq.raw_ref IS NOT NULL AND iq.storage_deleted_at IS NULL THEN 1 END) as items_with_active_storage,
  ROUND(100.0 * COUNT(iq.raw_ref) / COUNT(*), 2) as pct_with_storage
FROM ingestion_queue iq
JOIN status_lookup sl ON iq.status_code = sl.code
GROUP BY sl.code, sl.name
ORDER BY total_items DESC;

-- 3. Check when items were discovered (before vs after raw storage implementation)
SELECT 
  CASE 
    WHEN discovered_at < '2026-01-25' THEN 'Before raw storage (< Jan 25)'
    WHEN discovered_at >= '2026-01-25' AND discovered_at < '2026-01-26' THEN 'Jan 25 (implementation day)'
    WHEN discovered_at >= '2026-01-26' THEN 'After raw storage (>= Jan 26)'
  END as period,
  COUNT(*) as total_items,
  COUNT(raw_ref) as items_with_raw_ref,
  ROUND(100.0 * COUNT(raw_ref) / COUNT(*), 2) as pct_with_storage
FROM ingestion_queue
GROUP BY period
ORDER BY MIN(discovered_at);

-- 4. Find the 1 item that has raw storage
SELECT 
  iq.id,
  iq.url,
  iq.status_code,
  iq.raw_ref,
  iq.content_hash,
  ro.raw_store_mode,
  ro.mime_detected,
  ro.bytes,
  iq.discovered_at,
  iq.updated_at
FROM ingestion_queue iq
LEFT JOIN raw_object ro ON iq.content_hash = ro.content_hash
WHERE iq.raw_ref IS NOT NULL
ORDER BY iq.discovered_at DESC;

-- 5. Check items that were fetched but don't have raw_ref
-- (These went through the old fetch logic before raw storage was implemented)
SELECT 
  COUNT(*) as items_fetched_without_storage,
  COUNT(CASE WHEN status_code >= 200 THEN 1 END) as items_in_enrichment_or_later,
  COUNT(CASE WHEN status_code >= 300 THEN 1 END) as items_in_review_or_published
FROM ingestion_queue
WHERE raw_ref IS NULL
  AND status_code >= 112; -- 112 = fetched

-- 6. Check raw_object table contents
SELECT 
  content_hash,
  raw_ref,
  first_seen_at,
  mime_detected,
  bytes,
  ROUND(bytes::numeric / 1024 / 1024, 2) as mb,
  raw_store_mode
FROM raw_object
ORDER BY first_seen_at DESC;
