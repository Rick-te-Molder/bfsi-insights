-- Count items to backfill (excluding rejected 500 series)
SELECT 
  COUNT(*) as items_to_backfill,
  COUNT(CASE WHEN status_code < 200 THEN 1 END) as discovery_fetching,
  COUNT(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 END) as enrichment,
  COUNT(CASE WHEN status_code >= 300 AND status_code < 400 THEN 1 END) as review,
  COUNT(CASE WHEN status_code >= 400 AND status_code < 500 THEN 1 END) as published
FROM ingestion_queue
WHERE raw_ref IS NULL
  AND status_code < 500;  -- Exclude rejected (500 series)

-- Show breakdown by status
SELECT 
  sl.code,
  sl.name as status_name,
  COUNT(*) as count
FROM ingestion_queue iq
JOIN status_lookup sl ON iq.status_code = sl.code
WHERE iq.raw_ref IS NULL
  AND iq.status_code < 500  -- Exclude rejected
GROUP BY sl.code, sl.name
ORDER BY count DESC;
