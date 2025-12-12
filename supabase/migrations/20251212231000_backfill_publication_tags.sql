-- Backfill ALL taxonomy tags for existing publications
-- Matches kb_publication.source_url with ingestion_queue.url to get tags from payload

-- Insert industry tags
INSERT INTO kb_publication_bfsi_industry (publication_id, industry_code)
SELECT DISTINCT p.id, industry_code
FROM kb_publication p
JOIN ingestion_queue q ON p.source_url = q.url
CROSS JOIN LATERAL jsonb_array_elements_text(q.payload->'industry_codes') AS industry_code
WHERE NOT EXISTS (
  SELECT 1 FROM kb_publication_bfsi_industry pi WHERE pi.publication_id = p.id
)
AND q.payload->'industry_codes' IS NOT NULL
AND jsonb_array_length(q.payload->'industry_codes') > 0
ON CONFLICT DO NOTHING;

-- Insert topic tags
INSERT INTO kb_publication_bfsi_topic (publication_id, topic_code)
SELECT DISTINCT p.id, topic_code
FROM kb_publication p
JOIN ingestion_queue q ON p.source_url = q.url
CROSS JOIN LATERAL jsonb_array_elements_text(q.payload->'topic_codes') AS topic_code
WHERE NOT EXISTS (
  SELECT 1 FROM kb_publication_bfsi_topic pt WHERE pt.publication_id = p.id
)
AND q.payload->'topic_codes' IS NOT NULL
AND jsonb_array_length(q.payload->'topic_codes') > 0
ON CONFLICT DO NOTHING;

-- Insert regulator tags
INSERT INTO kb_publication_regulator (publication_id, regulator_code)
SELECT DISTINCT p.id, regulator_code
FROM kb_publication p
JOIN ingestion_queue q ON p.source_url = q.url
CROSS JOIN LATERAL jsonb_array_elements_text(q.payload->'regulator_codes') AS regulator_code
WHERE NOT EXISTS (
  SELECT 1 FROM kb_publication_regulator pr WHERE pr.publication_id = p.id
)
AND q.payload->'regulator_codes' IS NOT NULL
AND jsonb_array_length(q.payload->'regulator_codes') > 0
ON CONFLICT DO NOTHING;

-- Insert regulation tags
INSERT INTO kb_publication_regulation (publication_id, regulation_code)
SELECT DISTINCT p.id, regulation_code
FROM kb_publication p
JOIN ingestion_queue q ON p.source_url = q.url
CROSS JOIN LATERAL jsonb_array_elements_text(q.payload->'regulation_codes') AS regulation_code
WHERE NOT EXISTS (
  SELECT 1 FROM kb_publication_regulation preg WHERE preg.publication_id = p.id
)
AND q.payload->'regulation_codes' IS NOT NULL
AND jsonb_array_length(q.payload->'regulation_codes') > 0
ON CONFLICT DO NOTHING;

-- Insert process tags
INSERT INTO kb_publication_bfsi_process (publication_id, process_code)
SELECT DISTINCT p.id, process_code
FROM kb_publication p
JOIN ingestion_queue q ON p.source_url = q.url
CROSS JOIN LATERAL jsonb_array_elements_text(q.payload->'process_codes') AS process_code
WHERE NOT EXISTS (
  SELECT 1 FROM kb_publication_bfsi_process pp WHERE pp.publication_id = p.id
)
AND q.payload->'process_codes' IS NOT NULL
AND jsonb_array_length(q.payload->'process_codes') > 0
ON CONFLICT DO NOTHING;
