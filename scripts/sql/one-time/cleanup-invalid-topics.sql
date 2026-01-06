-- Clean up invalid/malformed topic codes from kb_publication_bfsi_topic
-- Keep only the 5 valid codes from bfsi_topics table

-- Valid topic codes:
-- - ecosystem
-- - methods-and-approaches
-- - regulatory-and-standards
-- - strategy-and-management
-- - technology-and-data

-- 1. First, check what we have
SELECT 
  pbt.topic_code,
  COUNT(*) as publication_count,
  CASE 
    WHEN bt.code IS NOT NULL THEN 'VALID'
    ELSE 'INVALID'
  END as status
FROM kb_publication_bfsi_topic pbt
LEFT JOIN bfsi_topic bt ON pbt.topic_code = bt.code
GROUP BY pbt.topic_code, bt.code
ORDER BY status, publication_count DESC;

-- 2. Count affected rows
SELECT COUNT(*) as rows_to_delete
FROM kb_publication_bfsi_topic pbt
LEFT JOIN bfsi_topic bt ON pbt.topic_code = bt.code
WHERE bt.code IS NULL;

-- 3. Show sample publications that will be affected
SELECT 
  p.id,
  p.title,
  pbt.topic_code
FROM kb_publication p
JOIN kb_publication_bfsi_topic pbt ON p.id = pbt.publication_id
LEFT JOIN bfsi_topic bt ON pbt.topic_code = bt.code
WHERE bt.code IS NULL
ORDER BY p.title
LIMIT 20;

-- 4. DELETE invalid topic codes
-- UNCOMMENT TO EXECUTE:

/*
DELETE FROM kb_publication_bfsi_topic
WHERE topic_code NOT IN (
  'ecosystem',
  'methods-and-approaches',
  'regulatory-and-standards',
  'strategy-and-management',
  'technology-and-data'
);
*/

-- 5. Verify cleanup (should return 0 rows)
/*
SELECT COUNT(*) as remaining_invalid_codes
FROM kb_publication_bfsi_topic pbt
LEFT JOIN bfsi_topic bt ON pbt.topic_code = bt.code
WHERE bt.code IS NULL;
*/
