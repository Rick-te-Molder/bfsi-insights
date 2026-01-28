-- Verify raw storage is working
-- Check if files are registered in database even if not visible in dashboard

-- 1. Count files in raw_object table
SELECT 
  COUNT(*) as total_files,
  COUNT(CASE WHEN raw_store_mode = 'full' THEN 1 END) as full_files,
  COUNT(CASE WHEN raw_store_mode = 'none' THEN 1 END) as hash_only,
  ROUND(SUM(bytes)::numeric / 1024 / 1024, 2) as total_mb
FROM raw_object;

-- 2. Recent files (last hour)
SELECT 
  raw_ref,
  mime_detected,
  ROUND(bytes::numeric / 1024, 2) as kb,
  raw_store_mode,
  first_seen_at
FROM raw_object
WHERE first_seen_at >= NOW() - INTERVAL '1 hour'
ORDER BY first_seen_at DESC
LIMIT 10;

-- 3. Sample of raw_ref values to check in storage
SELECT 
  raw_ref,
  content_hash,
  mime_detected
FROM raw_object
WHERE raw_store_mode = 'full'
ORDER BY first_seen_at DESC
LIMIT 5;
