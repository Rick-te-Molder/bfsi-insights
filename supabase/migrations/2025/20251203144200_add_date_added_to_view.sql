-- ============================================================================
-- KB-167: Add date_added and last_edited back to kb_publication_pretty view
-- ============================================================================
-- These columns were accidentally dropped in the linter fix migration.
-- Required for sorting publications by "recently added" vs "recently published".

DROP VIEW IF EXISTS kb_publication_pretty;
CREATE VIEW kb_publication_pretty
WITH (security_invoker = true)
AS
SELECT 
  p.id,
  p.slug,
  p.title,
  p.author,
  p.date_published,
  p.date_added,
  p.last_edited,
  p.source_url,
  p.source_name,
  p.source_domain,
  p.thumbnail,
  p.thumbnail_bucket,
  p.thumbnail_path,
  p.summary_short,
  p.summary_medium,
  p.summary_long,
  p.content_type,
  p.role,
  p.geography,
  p.status,
  -- Primary industry/topic
  (SELECT pi.industry_code 
   FROM kb_publication_bfsi_industry pi 
   WHERE pi.publication_id = p.id 
   ORDER BY pi.rank NULLS LAST 
   LIMIT 1) as industry,
  (SELECT pt.topic_code 
   FROM kb_publication_bfsi_topic pt 
   WHERE pt.publication_id = p.id 
   ORDER BY pt.rank NULLS LAST 
   LIMIT 1) as topic,
  -- Arrays
  COALESCE((SELECT array_agg(pi.industry_code ORDER BY pi.rank NULLS LAST)
   FROM kb_publication_bfsi_industry pi WHERE pi.publication_id = p.id), '{}') as industries,
  COALESCE((SELECT array_agg(pt.topic_code ORDER BY pt.rank NULLS LAST)
   FROM kb_publication_bfsi_topic pt WHERE pt.publication_id = p.id), '{}') as topics,
  COALESCE((SELECT array_agg(pr.regulator_code)
   FROM kb_publication_regulator pr WHERE pr.publication_id = p.id), '{}') as regulators,
  COALESCE((SELECT array_agg(preg.regulation_code)
   FROM kb_publication_regulation preg WHERE preg.publication_id = p.id), '{}') as regulations,
  COALESCE((SELECT array_agg(po.obligation_code)
   FROM kb_publication_obligation po WHERE po.publication_id = p.id), '{}') as obligations,
  COALESCE((SELECT array_agg(pp.process_code)
   FROM kb_publication_bfsi_process pp WHERE pp.publication_id = p.id), '{}') as processes
FROM kb_publication p
WHERE p.status = 'published';

GRANT SELECT ON kb_publication_pretty TO anon, authenticated;
