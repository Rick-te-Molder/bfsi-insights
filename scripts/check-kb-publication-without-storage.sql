-- Check kb_publication items without raw storage
-- These are published items that need backfilling

SELECT 
  COUNT(*) as total_published,
  COUNT(CASE WHEN origin_queue_id IS NOT NULL THEN 1 END) as with_origin_queue_id,
  COUNT(CASE WHEN origin_queue_id IS NULL THEN 1 END) as without_origin_queue_id
FROM kb_publication
WHERE status = 'published';

-- Check which published items have raw_ref via their origin_queue_id
SELECT 
  COUNT(*) as published_items,
  COUNT(CASE WHEN iq.raw_ref IS NOT NULL THEN 1 END) as with_raw_ref,
  COUNT(CASE WHEN iq.raw_ref IS NULL THEN 1 END) as without_raw_ref
FROM kb_publication kp
LEFT JOIN ingestion_queue iq ON kp.origin_queue_id = iq.id
WHERE kp.status = 'published';

-- Show examples of published items without raw storage
SELECT 
  kp.id,
  kp.slug,
  kp.source_url,
  kp.origin_queue_id,
  iq.raw_ref,
  kp.published_at
FROM kb_publication kp
LEFT JOIN ingestion_queue iq ON kp.origin_queue_id = iq.id
WHERE kp.status = 'published'
  AND (iq.raw_ref IS NULL OR kp.origin_queue_id IS NULL)
ORDER BY kp.published_at DESC
LIMIT 20;
