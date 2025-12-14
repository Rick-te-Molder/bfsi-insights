-- KB-224: Migrate audience and geography to junction tables
-- This creates junction tables for audience and geography to match the pattern
-- used by other taxonomy tags (industry, topic, etc.)

-- ============================================================================
-- 1. kb_audience table already exists with 'name' as identifier
--    (executive, functional_specialist, researcher, engineer)
-- ============================================================================

-- ============================================================================
-- 2. Create kb_publication_audience junction table
--    References kb_audience.name (not code, since table uses name as identifier)
-- ============================================================================
CREATE TABLE IF NOT EXISTS kb_publication_audience (
  publication_id UUID NOT NULL REFERENCES kb_publication(id) ON DELETE CASCADE,
  audience_code TEXT NOT NULL,
  score NUMERIC(3,2) DEFAULT 0.0,
  PRIMARY KEY (publication_id, audience_code)
);

CREATE INDEX IF NOT EXISTS idx_pub_audience_code ON kb_publication_audience(audience_code);
CREATE INDEX IF NOT EXISTS idx_pub_audience_score ON kb_publication_audience(score DESC);

-- ============================================================================
-- 3. Create kb_publication_geography junction table
-- ============================================================================
CREATE TABLE IF NOT EXISTS kb_publication_geography (
  publication_id UUID NOT NULL REFERENCES kb_publication(id) ON DELETE CASCADE,
  geography_code TEXT NOT NULL REFERENCES kb_geography(code) ON DELETE CASCADE,
  PRIMARY KEY (publication_id, geography_code)
);

CREATE INDEX IF NOT EXISTS idx_pub_geography_code ON kb_publication_geography(geography_code);

-- ============================================================================
-- 4. Update taxonomy_config for audience and geography
-- ============================================================================

-- Add audience to taxonomy_config (kb_audience uses 'name' as the code column)
INSERT INTO taxonomy_config (
  slug, display_name, display_name_plural, display_order, behavior_type,
  source_table, source_code_column, source_name_column,
  is_hierarchical, junction_table, junction_code_column, payload_field,
  include_list_in_prompt, prompt_section_title, prompt_instruction,
  color, is_active
) VALUES (
  'audience', 'Audience', 'Audiences', 0, 'scoring',
  'kb_audience', 'name', 'label',
  false, 'kb_publication_audience', 'audience_code', 'audience_scores',
  true, 'AUDIENCE SCORING', 'Score relevance 0.0-1.0 for each audience type.',
  'amber', true
) ON CONFLICT (slug) DO UPDATE SET
  source_code_column = 'name',
  source_name_column = 'label',
  junction_table = 'kb_publication_audience',
  junction_code_column = 'audience_code',
  is_active = true;

-- Update geography in taxonomy_config to use junction table
UPDATE taxonomy_config SET
  junction_table = 'kb_publication_geography',
  junction_code_column = 'geography_code'
WHERE slug = 'geography';

-- ============================================================================
-- 5. Migrate existing data from kb_publication columns to junction tables
-- ============================================================================

-- Migrate audience data (single value -> junction with score 1.0)
INSERT INTO kb_publication_audience (publication_id, audience_code, score)
SELECT id, audience, 1.0
FROM kb_publication
WHERE audience IS NOT NULL
ON CONFLICT (publication_id, audience_code) DO NOTHING;

-- Migrate geography data (single value -> junction)
INSERT INTO kb_publication_geography (publication_id, geography_code)
SELECT id, geography
FROM kb_publication
WHERE geography IS NOT NULL
ON CONFLICT (publication_id, geography_code) DO NOTHING;

-- ============================================================================
-- 6. Recreate kb_publication_pretty view with audiences[] and geographies[]
-- ============================================================================
DROP VIEW IF EXISTS kb_publication_pretty;

CREATE VIEW kb_publication_pretty AS
SELECT
  p.id,
  p.slug,
  p.title,
  p.authors,
  p.source_url AS url,
  p.source_name,
  p.source_domain,
  p.date_published,
  p.created_at AS date_added,
  p.updated_at AS last_edited,
  p.thumbnail,
  p.thumbnail_bucket,
  p.thumbnail_path,
  p.summary_short,
  p.summary_medium,
  p.summary_long,
  p.status,
  -- Audience: top scoring audience (for backwards compat) + all audiences array
  (SELECT audience_code FROM kb_publication_audience WHERE publication_id = p.id ORDER BY score DESC LIMIT 1) AS audience,
  COALESCE((SELECT array_agg(audience_code ORDER BY score DESC) FROM kb_publication_audience WHERE publication_id = p.id), '{}') AS audiences,
  -- Geography: first geography (for backwards compat) + all geographies array
  (SELECT geography_code FROM kb_publication_geography WHERE publication_id = p.id LIMIT 1) AS geography,
  COALESCE((SELECT array_agg(geography_code) FROM kb_publication_geography WHERE publication_id = p.id), '{}') AS geographies,
  -- Content type (still single value)
  p.content_type,
  -- Industry: first + all
  (SELECT industry_code FROM kb_publication_bfsi_industry WHERE publication_id = p.id ORDER BY rank LIMIT 1) AS industry,
  COALESCE((SELECT array_agg(industry_code ORDER BY rank) FROM kb_publication_bfsi_industry WHERE publication_id = p.id), '{}') AS industries,
  -- Topic: first + all
  (SELECT topic_code FROM kb_publication_bfsi_topic WHERE publication_id = p.id ORDER BY rank LIMIT 1) AS topic,
  COALESCE((SELECT array_agg(topic_code ORDER BY rank) FROM kb_publication_bfsi_topic WHERE publication_id = p.id), '{}') AS topics,
  -- Process: all
  COALESCE((SELECT array_agg(process_code ORDER BY rank) FROM kb_publication_bfsi_process WHERE publication_id = p.id), '{}') AS processes,
  -- Regulatory
  COALESCE((SELECT array_agg(regulator_code) FROM kb_publication_regulator WHERE publication_id = p.id), '{}') AS regulators,
  COALESCE((SELECT array_agg(regulation_code) FROM kb_publication_regulation WHERE publication_id = p.id), '{}') AS regulations,
  COALESCE((SELECT array_agg(obligation_code) FROM kb_publication_obligation WHERE publication_id = p.id), '{}') AS obligations,
  -- Legacy fields
  p.use_cases,
  p.agentic_capabilities
FROM kb_publication p
WHERE p.status = 'published';

-- Grant access
GRANT SELECT ON kb_publication_pretty TO anon, authenticated;
GRANT ALL ON kb_publication_audience TO anon, authenticated, service_role;
GRANT ALL ON kb_publication_geography TO anon, authenticated, service_role;
GRANT SELECT ON kb_audience TO anon, authenticated;

-- ============================================================================
-- 7. Add comments for documentation
-- ============================================================================
COMMENT ON TABLE kb_publication_audience IS 'Junction table linking publications to audience types with relevance scores';
COMMENT ON TABLE kb_publication_geography IS 'Junction table linking publications to geographic regions';
COMMENT ON COLUMN kb_publication_audience.score IS 'Relevance score 0.0-1.0 indicating how relevant the publication is for this audience';
