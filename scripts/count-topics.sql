-- Count how often each topic is tagged across all publications

SELECT 
  bt.code,
  bt.name,
  COUNT(pbt.publication_id) as publication_count,
  ROUND(COUNT(pbt.publication_id) * 100.0 / (SELECT COUNT(DISTINCT publication_id) FROM kb_publication_bfsi_topic), 1) as percentage
FROM bfsi_topic bt
LEFT JOIN kb_publication_bfsi_topic pbt ON bt.code = pbt.topic_code
GROUP BY bt.code, bt.name
ORDER BY publication_count DESC;
