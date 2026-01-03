-- Check all items in status 300 and their tag status
SELECT 
  id,
  url,
  payload->>'title' as title,
  payload->>'source_name' as source_name,
  payload->>'source' as source,
  payload->>'source_slug' as source_slug,
  CASE 
    WHEN payload->'audience_scores' IS NOT NULL AND (payload->'audience_scores')::text != '{}' THEN 'YES'
    ELSE 'NO'
  END as has_audiences,
  CASE 
    WHEN payload->'geography_codes' IS NOT NULL AND jsonb_array_length(payload->'geography_codes') > 0 THEN 'YES'
    ELSE 'NO'
  END as has_geographies,
  CASE 
    WHEN payload->'industry_codes' IS NOT NULL AND jsonb_array_length(payload->'industry_codes') > 0 THEN 'YES'
    ELSE 'NO'
  END as has_industries,
  CASE 
    WHEN payload->'topic_codes' IS NOT NULL AND jsonb_array_length(payload->'topic_codes') > 0 THEN 'YES'
    ELSE 'NO'
  END as has_topics,
  status_code
FROM ingestion_queue
WHERE status_code = 300
ORDER BY discovered_at DESC
LIMIT 10;
