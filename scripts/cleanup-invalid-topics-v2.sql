-- Clean up ALL topic data from kb_publication_bfsi_topic
-- The data is malformed (JSON arrays/objects instead of simple codes)
-- After cleanup, tagger v2.3 will re-tag publications with correct format

-- 1. Check current state - all data is malformed
SELECT 
  topic_code,
  COUNT(*) as count
FROM kb_publication_bfsi_topic
GROUP BY topic_code
ORDER BY count DESC
LIMIT 20;

-- 2. Count total rows
SELECT COUNT(*) as total_rows
FROM kb_publication_bfsi_topic;

-- 3. DELETE ALL topic data (it's all malformed)
-- UNCOMMENT TO EXECUTE:

/*
DELETE FROM kb_publication_bfsi_topic;
*/

-- 4. Verify cleanup (should return 0)
/*
SELECT COUNT(*) as remaining_rows
FROM kb_publication_bfsi_topic;
*/

-- After running this:
-- 1. Deploy tagger v2.3 with topic tagging instructions
-- 2. Re-run tagger on all publications to populate topics correctly
