-- Find PDF files in storage
SELECT 
  iq.id,
  iq.url,
  iq.raw_ref,
  ro.mime_detected,
  ROUND(ro.bytes::numeric / 1024, 2) as kb
FROM ingestion_queue iq
JOIN raw_object ro ON iq.content_hash = ro.content_hash
WHERE iq.raw_ref IS NOT NULL
  AND ro.mime_detected = 'application/pdf'
ORDER BY ro.first_seen_at DESC
LIMIT 10;
