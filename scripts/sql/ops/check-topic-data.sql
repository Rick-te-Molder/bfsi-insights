-- Check what topic data exists in publications
-- Compare with bfsi_topics table which only has 5 codes

-- 1. Check unique topic values in kb_publication
SELECT DISTINCT topic
FROM kb_publication
WHERE topic IS NOT NULL
ORDER BY topic
LIMIT 20;

-- 2. Check if topic is stored as array or single value
SELECT 
  id,
  title,
  topic,
  pg_typeof(topic) as topic_type
FROM kb_publication
WHERE topic IS NOT NULL
LIMIT 10;

-- 3. Check junction table kb_publication_bfsi_topic
SELECT 
  pbt.topic_code,
  COUNT(*) as publication_count
FROM kb_publication_bfsi_topic pbt
GROUP BY pbt.topic_code
ORDER BY publication_count DESC;

-- 4. Find topic codes in junction table that don't exist in bfsi_topics
SELECT DISTINCT pbt.topic_code
FROM kb_publication_bfsi_topic pbt
LEFT JOIN bfsi_topics bt ON pbt.topic_code = bt.code
WHERE bt.code IS NULL
ORDER BY pbt.topic_code;

-- 5. Count how many invalid topic codes exist
SELECT COUNT(DISTINCT pbt.topic_code) as invalid_topic_codes
FROM kb_publication_bfsi_topic pbt
LEFT JOIN bfsi_topics bt ON pbt.topic_code = bt.code
WHERE bt.code IS NULL;
