-- Fix kb_publication_pretty view to include singular industry/topic fields
-- This enables the publications page filters to work correctly

DROP VIEW IF EXISTS kb_publication_pretty CASCADE;

CREATE OR REPLACE VIEW kb_publication_pretty AS
SELECT 
  p.id,
  p.slug,
  p.title,
  p.author as authors,
  p.date_published,
  p.date_added,
  p.last_edited,
  p.source_url as url,
  p.source_name,
  p.source_domain,
  p.thumbnail,
  p.summary_short,
  p.summary_medium,
  p.summary_long,
  p.role,
  p.content_type,
  p.geography,
  p.use_cases,
  p.agentic_capabilities,
  p.status,
  -- Arrays for comprehensive data
  COALESCE(
    ARRAY_AGG(DISTINCT pbi.industry_code) FILTER (WHERE pbi.industry_code IS NOT NULL),
    ARRAY[]::text[]
  ) as industries,
  COALESCE(
    ARRAY_AGG(DISTINCT pbt.topic_code) FILTER (WHERE pbt.topic_code IS NOT NULL),
    ARRAY[]::text[]
  ) as topics,
  -- Singular fields for filtering (first value from arrays)
  (ARRAY_AGG(DISTINCT pbi.industry_code) FILTER (WHERE pbi.industry_code IS NOT NULL))[1] as industry,
  (ARRAY_AGG(DISTINCT pbt.topic_code) FILTER (WHERE pbt.topic_code IS NOT NULL))[1] as topic
FROM kb_publication p
LEFT JOIN kb_publication_bfsi_industry pbi ON p.id = pbi.publication_id
LEFT JOIN kb_publication_bfsi_topic pbt ON p.id = pbt.publication_id
GROUP BY p.id;

GRANT SELECT ON kb_publication_pretty TO anon, authenticated;