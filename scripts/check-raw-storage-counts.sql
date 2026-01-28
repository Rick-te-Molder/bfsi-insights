-- ============================================================================
-- Check Raw Data Storage Counts
-- ============================================================================
-- Query to check how many items have been stored permanently as PDF and text

-- 1. Count by MIME type in raw_object table
SELECT 
  CASE 
    WHEN mime_detected LIKE 'application/pdf%' THEN 'PDF'
    WHEN mime_detected LIKE 'text/%' THEN 'Text'
    WHEN mime_detected LIKE 'application/json%' THEN 'JSON'
    WHEN mime_detected LIKE 'text/html%' THEN 'HTML'
    ELSE 'Other'
  END AS content_type,
  COUNT(*) as count,
  SUM(bytes) as total_bytes,
  ROUND(SUM(bytes)::numeric / 1024 / 1024, 2) as total_mb
FROM raw_object
WHERE raw_store_mode = 'full'
GROUP BY content_type
ORDER BY count DESC;

-- 2. Count by storage mode
SELECT 
  raw_store_mode,
  COUNT(*) as count,
  SUM(bytes) as total_bytes,
  ROUND(SUM(bytes)::numeric / 1024 / 1024, 2) as total_mb
FROM raw_object
GROUP BY raw_store_mode
ORDER BY count DESC;

-- 3. Total counts
SELECT 
  COUNT(*) as total_objects,
  COUNT(CASE WHEN raw_store_mode = 'full' THEN 1 END) as stored_full,
  COUNT(CASE WHEN raw_store_mode = 'none' THEN 1 END) as hash_only,
  COUNT(CASE WHEN mime_detected LIKE 'application/pdf%' THEN 1 END) as pdf_count,
  COUNT(CASE WHEN mime_detected LIKE 'text/%' THEN 1 END) as text_count,
  ROUND(SUM(bytes)::numeric / 1024 / 1024, 2) as total_mb
FROM raw_object;

-- 4. Items in ingestion_queue with stored raw content
SELECT 
  COUNT(*) as total_queue_items,
  COUNT(CASE WHEN raw_ref IS NOT NULL THEN 1 END) as items_with_raw_ref,
  COUNT(CASE WHEN raw_ref IS NOT NULL AND storage_deleted_at IS NULL THEN 1 END) as items_with_active_storage
FROM ingestion_queue;

-- 5. Recent storage activity (last 7 days)
SELECT 
  DATE(first_seen_at) as date,
  COUNT(*) as objects_stored,
  ROUND(SUM(bytes)::numeric / 1024 / 1024, 2) as mb_stored
FROM raw_object
WHERE first_seen_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(first_seen_at)
ORDER BY date DESC;
