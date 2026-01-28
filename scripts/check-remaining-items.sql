-- Check remaining items without raw storage
-- Shows breakdown by status to prioritize backfill

SELECT 
  sl.code,
  sl.name as status_name,
  COUNT(*) as items_without_storage
FROM ingestion_queue iq
JOIN status_lookup sl ON iq.status_code = sl.code
WHERE iq.raw_ref IS NULL
GROUP BY sl.code, sl.name
ORDER BY items_without_storage DESC;

-- Total remaining
SELECT 
  COUNT(*) as total_items_without_storage,
  COUNT(CASE WHEN status_code >= 200 THEN 1 END) as enriched_or_later,
  COUNT(CASE WHEN status_code < 200 THEN 1 END) as discovery_or_fetching
FROM ingestion_queue
WHERE raw_ref IS NULL;
