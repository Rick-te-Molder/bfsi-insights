-- View stored raw content files
-- Shows examples of items with raw storage and their metadata

-- 1. Sample of items with raw storage
SELECT 
  iq.id,
  iq.url,
  iq.raw_ref,
  ro.mime_detected,
  ro.bytes,
  ROUND(ro.bytes::numeric / 1024, 2) as kb,
  ro.raw_store_mode,
  ro.first_seen_at,
  iq.status_code,
  sl.name as status_name
FROM ingestion_queue iq
JOIN raw_object ro ON iq.content_hash = ro.content_hash
JOIN status_lookup sl ON iq.status_code = sl.code
WHERE iq.raw_ref IS NOT NULL
ORDER BY ro.first_seen_at DESC
LIMIT 20;

-- 2. Count by MIME type
SELECT 
  ro.mime_detected,
  COUNT(*) as count,
  ROUND(AVG(ro.bytes)::numeric / 1024, 2) as avg_kb,
  ROUND(SUM(ro.bytes)::numeric / 1024 / 1024, 2) as total_mb
FROM raw_object ro
WHERE ro.raw_store_mode = 'full'
GROUP BY ro.mime_detected
ORDER BY count DESC;

-- 3. Largest files stored
SELECT 
  iq.url,
  iq.raw_ref,
  ro.mime_detected,
  ROUND(ro.bytes::numeric / 1024 / 1024, 2) as mb
FROM ingestion_queue iq
JOIN raw_object ro ON iq.content_hash = ro.content_hash
WHERE iq.raw_ref IS NOT NULL
ORDER BY ro.bytes DESC
LIMIT 10;

-- 4. Recently stored files
SELECT 
  iq.url,
  iq.raw_ref,
  ro.mime_detected,
  ROUND(ro.bytes::numeric / 1024, 2) as kb,
  ro.first_seen_at
FROM ingestion_queue iq
JOIN raw_object ro ON iq.content_hash = ro.content_hash
WHERE iq.raw_ref IS NOT NULL
  AND ro.first_seen_at >= NOW() - INTERVAL '1 hour'
ORDER BY ro.first_seen_at DESC;
