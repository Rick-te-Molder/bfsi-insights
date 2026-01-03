-- Move items in status 300 (pending_review) that are missing tags back to status 220 (to_tag)
-- This will trigger the tagging step in the enrichment pipeline

UPDATE ingestion_queue
SET status_code = 220
WHERE status_code = 300
  AND (
    -- Check if any taxonomy fields are missing or empty
    (payload->'audience_scores' IS NULL OR jsonb_typeof(payload->'audience_scores') = 'null' OR (payload->'audience_scores')::text = '{}')
    AND (payload->'geography_codes' IS NULL OR jsonb_typeof(payload->'geography_codes') = 'null' OR jsonb_array_length(payload->'geography_codes') = 0)
    AND (payload->'industry_codes' IS NULL OR jsonb_typeof(payload->'industry_codes') = 'null' OR jsonb_array_length(payload->'industry_codes') = 0)
    AND (payload->'topic_codes' IS NULL OR jsonb_typeof(payload->'topic_codes') = 'null' OR jsonb_array_length(payload->'topic_codes') = 0)
  );

-- Show the affected items
SELECT id, url, payload->>'title' as title, status_code
FROM ingestion_queue
WHERE status_code = 220
  AND (
    (payload->'audience_scores' IS NULL OR jsonb_typeof(payload->'audience_scores') = 'null' OR (payload->'audience_scores')::text = '{}')
    AND (payload->'geography_codes' IS NULL OR jsonb_typeof(payload->'geography_codes') = 'null' OR jsonb_array_length(payload->'geography_codes') = 0)
    AND (payload->'industry_codes' IS NULL OR jsonb_typeof(payload->'industry_codes') = 'null' OR jsonb_array_length(payload->'industry_codes') = 0)
    AND (payload->'topic_codes' IS NULL OR jsonb_typeof(payload->'topic_codes') = 'null' OR jsonb_array_length(payload->'topic_codes') = 0)
  );
