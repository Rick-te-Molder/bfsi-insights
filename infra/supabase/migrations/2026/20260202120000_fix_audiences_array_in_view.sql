-- ============================================================================
-- Fix missing audiences[] array in kb_publication_pretty view
-- ============================================================================
-- Issue: Audience filter showing wrong cards and incorrect counts on home page
--
-- Root cause: Migration 20260128150000 recreated the view but FORGOT to include
-- the audiences[] array, despite the comment at line 89 saying it would.
--
-- Evidence:
--   - kb_publication_audience junction table has 178 rows (multi-audience data)
--   - Frontend code (index.astro:61) checks p.audiences array for filtering
--   - PublicationCard.astro:71 uses audiences.join(',') for data-audiences attr
--   - Client-side filter (index.astro:196) reads data-audiences to show/hide
--
-- Without audiences[], filtering falls back to singular p.audience which only
-- contains the TOP scoring audience, causing publications to not appear in
-- secondary audience views (e.g., exec+engineer pub won't show for engineers).
--
-- Schema verification (docs/data-model/schema.md):
--   - kb_publication_audience: EXISTS (178 rows)
--   - kb_publication_bfsi_industry: EXISTS (172 rows)
--   - kb_publication_bfsi_topic: EXISTS (1 row)
--   - kb_publication_bfsi_process: EXISTS (7 rows)
--   - kb_publication_regulator: EXISTS (8 rows)
--   - kb_publication_regulation: EXISTS (0 rows)
--   - kb_publication_obligation: EXISTS (0 rows)
--   - kb_publication_geography: DOES NOT EXIST (geography is single column)
-- ============================================================================

DROP VIEW IF EXISTS public.kb_publication_pretty;

CREATE VIEW public.kb_publication_pretty
WITH (security_invoker = true) AS
SELECT
  p.id,
  p.slug,
  p.title,
  p.author,
  p.published_at,
  p.added_at,
  p.last_edited_at,
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
  p.geography,
  p.status,
  p.origin_queue_id,
  -- Singular fields (backwards compat)
  (SELECT audience_code 
   FROM public.kb_publication_audience 
   WHERE publication_id = p.id 
   ORDER BY score DESC 
   LIMIT 1) AS audience,
  (SELECT industry_code 
   FROM public.kb_publication_bfsi_industry 
   WHERE publication_id = p.id 
   ORDER BY rank NULLS LAST 
   LIMIT 1) AS industry,
  (SELECT topic_code 
   FROM public.kb_publication_bfsi_topic 
   WHERE publication_id = p.id 
   ORDER BY rank NULLS LAST 
   LIMIT 1) AS topic,
  -- Array fields for multi-value filtering
  COALESCE((SELECT array_agg(audience_code ORDER BY score DESC)
   FROM public.kb_publication_audience WHERE publication_id = p.id), '{}') AS audiences,
  COALESCE((SELECT array_agg(industry_code ORDER BY rank NULLS LAST)
   FROM public.kb_publication_bfsi_industry WHERE publication_id = p.id), '{}') AS industries,
  COALESCE((SELECT array_agg(topic_code ORDER BY rank NULLS LAST)
   FROM public.kb_publication_bfsi_topic WHERE publication_id = p.id), '{}') AS topics,
  COALESCE((SELECT array_agg(regulator_code)
   FROM public.kb_publication_regulator WHERE publication_id = p.id), '{}') AS regulators,
  COALESCE((SELECT array_agg(regulation_code)
   FROM public.kb_publication_regulation WHERE publication_id = p.id), '{}') AS regulations,
  COALESCE((SELECT array_agg(obligation_code)
   FROM public.kb_publication_obligation WHERE publication_id = p.id), '{}') AS obligations,
  COALESCE((SELECT array_agg(process_code)
   FROM public.kb_publication_bfsi_process WHERE publication_id = p.id), '{}') AS processes
FROM public.kb_publication p
WHERE p.status = 'published';

COMMENT ON VIEW public.kb_publication_pretty IS 'Flattened view of published items with all taxonomy arrays for filtering';

GRANT SELECT ON public.kb_publication_pretty TO anon, authenticated;
