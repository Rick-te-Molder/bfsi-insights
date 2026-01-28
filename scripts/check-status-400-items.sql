-- Check items with status 400 in ingestion_queue
SELECT 
  COUNT(*) as total_status_400,
  COUNT(raw_ref) as with_raw_ref,
  COUNT(*) - COUNT(raw_ref) as without_raw_ref
FROM ingestion_queue
WHERE status_code = 400;

-- Show some examples of status 400 items
SELECT 
  id,
  url,
  status_code,
  raw_ref,
  discovered_at
FROM ingestion_queue
WHERE status_code = 400
ORDER BY discovered_at DESC
LIMIT 20;
