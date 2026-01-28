-- ============================================================================
-- Add kb_publication_audience junction table (admin-only access)
-- ============================================================================
-- Related to PR #690: https://github.com/Rick-te-Molder/bfsi-insights/pull/690
--
-- This migration:
-- 1. Creates kb_publication_audience junction table to store audience scores
-- 2. Enables RLS and restricts access to service_role only (admin/server-side)
-- 3. Updates taxonomy_config to wire audience_scores -> kb_publication_audience
-- 4. Backfills existing kb_publication.audience values as score 1.0
--
-- Why admin-only: Published audience scores are internal data quality metrics.
-- Public consumption uses kb_publication_pretty.audience (single top audience).

-- ============================================================================
-- 1. Create kb_publication_audience junction table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.kb_publication_audience (
  publication_id UUID NOT NULL REFERENCES public.kb_publication(id) ON DELETE CASCADE,
  audience_code TEXT NOT NULL,
  score NUMERIC(3,2) DEFAULT 0.0,
  PRIMARY KEY (publication_id, audience_code)
);

CREATE INDEX IF NOT EXISTS idx_pub_audience_code ON public.kb_publication_audience(audience_code);
CREATE INDEX IF NOT EXISTS idx_pub_audience_score ON public.kb_publication_audience(score DESC);

COMMENT ON TABLE public.kb_publication_audience IS 'Junction table linking publications to audience types with relevance scores (admin-only access)';
COMMENT ON COLUMN public.kb_publication_audience.score IS 'Relevance score 0.0-1.0 indicating how relevant the publication is for this audience';

-- ============================================================================
-- 2. Enable RLS and restrict to service_role only
-- ============================================================================
ALTER TABLE public.kb_publication_audience ENABLE ROW LEVEL SECURITY;

-- Service role full access (admin/server-side only)
DROP POLICY IF EXISTS "kb_publication_audience_service_all" ON public.kb_publication_audience;
CREATE POLICY "kb_publication_audience_service_all" 
  ON public.kb_publication_audience
  FOR ALL 
  TO service_role
  USING (public.is_service_role())
  WITH CHECK (public.is_service_role());

-- Grant to service_role only (no anon/authenticated access)
GRANT ALL ON public.kb_publication_audience TO service_role;

-- ============================================================================
-- 3. Update taxonomy_config for audience_scores -> kb_publication_audience
-- ============================================================================
-- This wires the existing insertTaxonomyTags() publish flow to automatically
-- insert audience score rows during approval.

INSERT INTO public.taxonomy_config (
  slug, display_name, display_name_plural, display_order, behavior_type,
  source_table, is_hierarchical, junction_table, junction_code_column, payload_field,
  include_list_in_prompt, prompt_section_title, prompt_instruction,
  color, is_active
) VALUES (
  'audience', 'Audience', 'Audiences', 0, 'scoring',
  'kb_audience', false, 'kb_publication_audience', 'audience_code', 'audience_scores',
  true, 'AUDIENCE SCORING', 'Score relevance 0.0-1.0 for each audience type.',
  'amber', true
)
ON CONFLICT (slug) DO UPDATE SET
  source_table = EXCLUDED.source_table,
  junction_table = EXCLUDED.junction_table,
  junction_code_column = EXCLUDED.junction_code_column,
  payload_field = EXCLUDED.payload_field,
  is_active = EXCLUDED.is_active;

-- ============================================================================
-- 4. Backfill existing kb_publication.audience -> junction table
-- ============================================================================
-- For existing published items, insert their current audience as score 1.0
-- (since we don't have the original payload scores for already-published items)

INSERT INTO public.kb_publication_audience (publication_id, audience_code, score)
SELECT id, audience, 1.0
FROM public.kb_publication
WHERE audience IS NOT NULL
  AND status = 'published'
ON CONFLICT (publication_id, audience_code) DO NOTHING;

-- ============================================================================
-- 5. Update kb_publication_pretty view to use junction table
-- ============================================================================
-- Recreate the view to pull audience from the junction table (top score)
-- and audiences array from the junction table (all scores DESC)

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
  -- Audience: top scoring audience from junction table (backwards compat)
  (SELECT audience_code 
   FROM public.kb_publication_audience 
   WHERE publication_id = p.id 
   ORDER BY score DESC 
   LIMIT 1) AS audience,
  -- Industry (backwards compat)
  (SELECT industry_code 
   FROM public.kb_publication_bfsi_industry 
   WHERE publication_id = p.id 
   ORDER BY rank NULLS LAST 
   LIMIT 1) AS industry,
  -- Topic (backwards compat)
  (SELECT topic_code 
   FROM public.kb_publication_bfsi_topic 
   WHERE publication_id = p.id 
   ORDER BY rank NULLS LAST 
   LIMIT 1) AS topic,
  -- Arrays for all taxonomy types
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

COMMENT ON VIEW public.kb_publication_pretty IS 'Flattened view of published items with audience from junction table';

-- Grant access to view
GRANT SELECT ON public.kb_publication_pretty TO anon, authenticated;
