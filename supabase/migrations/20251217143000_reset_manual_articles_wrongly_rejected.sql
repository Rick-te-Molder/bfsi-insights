-- KB-277: Reset manual articles that were wrongly rejected by relevance filter
-- Manual articles should never be rejected for relevance - humans already deemed them relevant

UPDATE ingestion_queue
SET 
  status_code = 200, -- PENDING_ENRICHMENT
  payload = payload - 'rejection_reason' -- Remove rejection reason
WHERE 
  status_code = 530 -- IRRELEVANT
  AND (
    entry_type = 'manual' 
    OR payload->>'manual_add' = 'true'
  );
