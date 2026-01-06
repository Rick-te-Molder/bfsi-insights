-- Delete only the malformed topic codes (JSON arrays/objects)
-- Keep the valid simple text codes

-- 1. Find malformed codes (contain [ or {)
SELECT 
  publication_id,
  topic_code
FROM kb_publication_bfsi_topic
WHERE topic_code LIKE '%[%' OR topic_code LIKE '%{%';

-- 2. Delete malformed codes
DELETE FROM kb_publication_bfsi_topic
WHERE topic_code LIKE '%[%' OR topic_code LIKE '%{%';

-- 3. Verify (should return 0)
SELECT COUNT(*) as remaining_malformed
FROM kb_publication_bfsi_topic
WHERE topic_code LIKE '%[%' OR topic_code LIKE '%{%';
