-- ============================================================================
-- KB-198: Rename kb_role to kb_audience and align taxonomy
-- ============================================================================
-- This migration:
-- 1. Renames kb_role table to kb_audience
-- 2. Updates values to: executive, functional_specialist, engineer, researcher
-- 3. Renames kb_publication.role to kb_publication.audience
-- 4. Updates taxonomy_config persona entries to match
-- 5. Updates approve_from_queue function
-- 6. Migrates existing data

-- ============================================================================
-- 1. Rename kb_role table to kb_audience
-- ============================================================================

ALTER TABLE kb_role RENAME TO kb_audience;

-- ============================================================================
-- 2. Update kb_audience values
-- ============================================================================

-- Clear existing values
TRUNCATE kb_audience;

-- Insert new audience types
INSERT INTO kb_audience (value, label, description, sort_order) VALUES
('executive', 'Executives', 'C-level and senior leadership (strategy, big-picture)', 1),
('functional_specialist', 'Functional Specialists', 'Product managers, risk/legal/compliance specialists, auditors, business analysts', 2),
('engineer', 'Engineers', 'Software developers, DevOps, security engineers, architects', 3),
('researcher', 'Researchers', 'Academics, PhD/Masters, scientific researchers', 4);

-- ============================================================================
-- 3. Rename kb_publication.role to kb_publication.audience
-- ============================================================================

ALTER TABLE kb_publication RENAME COLUMN role TO audience;

-- ============================================================================
-- 4. Update taxonomy_config persona entries
-- ============================================================================

-- Delete old persona scoring entries
DELETE FROM taxonomy_config WHERE slug LIKE 'persona_%';

-- Insert new audience scoring entries
INSERT INTO taxonomy_config (
  slug, display_name, display_order, behavior_type,
  payload_field, include_list_in_prompt, prompt_section_title, prompt_instruction,
  color, score_parent_slug, score_threshold, show_confidence
) VALUES
('audience_executive', 'Executive', 9, 'scoring',
 'audience_scores.executive', FALSE, NULL,
 'C-suite, board members, senior leadership (interested in: strategy, market trends, competitive advantage, business impact)',
 'violet', 'audience', 0.5, TRUE),

('audience_functional_specialist', 'Specialist', 10, 'scoring',
 'audience_scores.functional_specialist', FALSE, NULL,
 'Product managers, risk/compliance/legal specialists, auditors, business analysts (interested in: processes, regulations, best practices, vendor solutions)',
 'violet', 'audience', 0.5, TRUE),

('audience_engineer', 'Engineer', 11, 'scoring',
 'audience_scores.engineer', FALSE, NULL,
 'Developers, architects, DevOps, security engineers (interested in: implementation, APIs, architecture, technical details)',
 'violet', 'audience', 0.5, TRUE),

('audience_researcher', 'Researcher', 12, 'scoring',
 'audience_scores.researcher', FALSE, NULL,
 'Academics, PhD researchers, analysts (interested in: methodology, data, peer-reviewed findings, theoretical frameworks)',
 'violet', 'audience', 0.5, TRUE);

-- ============================================================================
-- 5. Migrate existing publication data
-- ============================================================================

-- Map old role values to new audience values
UPDATE kb_publication SET audience = 
  CASE audience
    WHEN 'executive' THEN 'executive'
    WHEN 'professional' THEN 'functional_specialist'
    WHEN 'researcher' THEN 'researcher'
    ELSE 'functional_specialist'  -- default fallback
  END
WHERE audience IS NOT NULL;

-- ============================================================================
-- 6. Update kb_publication_pretty view
-- ============================================================================

DROP VIEW IF EXISTS kb_publication_pretty;

CREATE OR REPLACE VIEW kb_publication_pretty AS
SELECT 
  p.id,
  p.slug,
  p.title,
  p.author AS authors,
  p.source_url AS url,
  p.source_name,
  p.date_published,
  p.date_added,
  p.last_edited,
  p.thumbnail,
  p.thumbnail_bucket,
  p.thumbnail_path,
  p.summary_short,
  p.summary_medium,
  p.summary_long,
  p.audience,  -- renamed from role
  p.content_type,
  p.use_cases,
  p.agentic_capabilities,
  p.status,
  -- Aggregated relationships
  (SELECT string_agg(g.name, ', ') FROM kb_publication_geography pg 
   JOIN bfsi_geography g ON pg.geography_code = g.code WHERE pg.publication_id = p.id) AS geography,
  (SELECT string_agg(i.name, ', ') FROM kb_publication_bfsi_industry pi 
   JOIN bfsi_industry i ON pi.industry_code = i.code WHERE pi.publication_id = p.id) AS industry,
  (SELECT string_agg(t.name, ', ') FROM kb_publication_bfsi_topic pt 
   JOIN bfsi_topic t ON pt.topic_code = t.code WHERE pt.publication_id = p.id) AS topic,
  (SELECT array_agg(i.code) FROM kb_publication_bfsi_industry pi 
   JOIN bfsi_industry i ON pi.industry_code = i.code WHERE pi.publication_id = p.id) AS industries,
  (SELECT array_agg(t.code) FROM kb_publication_bfsi_topic pt 
   JOIN bfsi_topic t ON pt.topic_code = t.code WHERE pt.publication_id = p.id) AS topics,
  (SELECT array_agg(pr.code) FROM kb_publication_bfsi_process pp 
   JOIN bfsi_process pr ON pp.process_code = pr.code WHERE pp.publication_id = p.id) AS processes,
  (SELECT array_agg(r.slug) FROM kb_publication_regulator preg 
   JOIN regulator r ON preg.regulator_slug = r.slug WHERE preg.publication_id = p.id) AS regulators,
  (SELECT array_agg(reg.slug) FROM kb_publication_regulation preg 
   JOIN regulation reg ON preg.regulation_slug = reg.slug WHERE preg.publication_id = p.id) AS regulations,
  (SELECT array_agg(o.slug) FROM kb_publication_obligation po 
   JOIN obligation o ON po.obligation_slug = o.slug WHERE po.publication_id = p.id) AS obligations
FROM kb_publication p;

-- Grant access to the view
GRANT SELECT ON kb_publication_pretty TO anon, authenticated;

-- ============================================================================
-- 7. Update approve_from_queue function
-- ============================================================================

CREATE OR REPLACE FUNCTION approve_from_queue(p_queue_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_queue ingestion_queue%ROWTYPE;
  v_id uuid;
  v_slug text;
  v_payload jsonb;
  v_source_domain text;
  v_industry_code text;
  v_topic_code text;
  v_regulator_code text;
  v_regulation_code text;
  v_obligation_code text;
  v_process_code text;
  v_vendor_name text;
  v_org_name text;
  v_thumb_bucket text;
  v_thumb_path text;
  v_audience text;
  v_exec_score float;
  v_spec_score float;
  v_eng_score float;
  v_res_score float;
BEGIN
  -- Get enriched item
  SELECT * INTO v_queue 
  FROM ingestion_queue 
  WHERE id = p_queue_id AND status = 'enriched' 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Queue item % not found or not enriched', p_queue_id;
  END IF;
  
  v_payload := v_queue.payload;
  v_source_domain := (regexp_match(v_queue.url, 'https?://([^/]+)'))[1];

  -- Extract thumbnail info from payload
  v_thumb_bucket := COALESCE(v_payload->>'thumbnail_bucket', 'asset');
  v_thumb_path := v_payload->>'thumbnail_path';
  
  -- Generate slug
  v_slug := lower(regexp_replace(
    regexp_replace(v_payload->>'title', '[^a-zA-Z0-9\s-]', '', 'g'),
    '\s+', '-', 'g'
  ));
  v_slug := substring(v_slug from 1 for 100);
  
  -- Ensure unique slug
  WHILE EXISTS (SELECT 1 FROM kb_publication WHERE slug = v_slug) LOOP
    v_slug := v_slug || '-' || substring(md5(random()::text) from 1 for 6);
  END LOOP;
  
  -- Determine audience from scores (pick highest)
  v_exec_score := COALESCE((v_payload->'audience_scores'->>'executive')::float, 0);
  v_spec_score := COALESCE((v_payload->'audience_scores'->>'functional_specialist')::float, 0);
  v_eng_score := COALESCE((v_payload->'audience_scores'->>'engineer')::float, 0);
  v_res_score := COALESCE((v_payload->'audience_scores'->>'researcher')::float, 0);
  
  -- Pick the audience with highest score (default to functional_specialist)
  v_audience := 'functional_specialist';
  IF v_exec_score >= v_spec_score AND v_exec_score >= v_eng_score AND v_exec_score >= v_res_score AND v_exec_score >= 0.5 THEN
    v_audience := 'executive';
  ELSIF v_eng_score >= v_spec_score AND v_eng_score >= v_res_score AND v_eng_score >= 0.5 THEN
    v_audience := 'engineer';
  ELSIF v_res_score >= v_spec_score AND v_res_score >= 0.5 THEN
    v_audience := 'researcher';
  ELSIF v_spec_score >= 0.5 THEN
    v_audience := 'functional_specialist';
  END IF;
  
  -- Check for existing by source_url
  SELECT id INTO v_id FROM kb_publication WHERE source_url = v_queue.url_norm;
  
  IF v_id IS NOT NULL THEN
    -- Update existing
    UPDATE kb_publication SET
      title = v_payload->>'title',
      date_published = (v_payload->>'published_at')::timestamptz,
      summary_short = v_payload->'summary'->>'short',
      summary_medium = v_payload->'summary'->>'medium',
      summary_long = v_payload->'summary'->>'long',
      thumbnail_bucket = v_thumb_bucket,
      thumbnail_path = v_thumb_path,
      audience = v_audience,
      last_edited = now()
    WHERE id = v_id;
    
    -- Clear existing relationships for re-tagging
    DELETE FROM kb_publication_bfsi_industry WHERE publication_id = v_id;
    DELETE FROM kb_publication_bfsi_topic WHERE publication_id = v_id;
    DELETE FROM kb_publication_regulator WHERE publication_id = v_id;
    DELETE FROM kb_publication_regulation WHERE publication_id = v_id;
    DELETE FROM kb_publication_obligation WHERE publication_id = v_id;
    DELETE FROM kb_publication_bfsi_process WHERE publication_id = v_id;
  ELSE
    -- Insert new publication
    INSERT INTO kb_publication (
      slug, title, author, date_published, 
      source_url, source_name, source_domain,
      thumbnail_bucket, thumbnail_path,
      summary_short, summary_medium, summary_long,
      audience, content_type,
      status, origin_queue_id
    )
    VALUES (
      v_slug,
      v_payload->>'title',
      NULL,
      (v_payload->>'published_at')::timestamptz,
      v_queue.url,
      v_source_domain,
      v_source_domain,
      v_thumb_bucket,
      v_thumb_path,
      v_payload->'summary'->>'short',
      v_payload->'summary'->>'medium',
      v_payload->'summary'->>'long',
      v_audience,
      'article',
      'published',
      p_queue_id
    )
    RETURNING id INTO v_id;
  END IF;
  
  -- Insert industry relationships
  FOR v_industry_code IN 
    SELECT jsonb_array_elements_text(COALESCE(v_payload->'industry_codes', '[]'::jsonb))
    WHERE jsonb_array_elements_text IS NOT NULL 
      AND jsonb_array_elements_text != 'null'
  LOOP
    INSERT INTO kb_publication_bfsi_industry (publication_id, industry_code)
    VALUES (v_id, v_industry_code)
    ON CONFLICT DO NOTHING;
  END LOOP;
  
  -- Insert topic relationships
  FOR v_topic_code IN 
    SELECT jsonb_array_elements_text(COALESCE(v_payload->'topic_codes', '[]'::jsonb))
    WHERE jsonb_array_elements_text IS NOT NULL 
      AND jsonb_array_elements_text != 'null'
  LOOP
    INSERT INTO kb_publication_bfsi_topic (publication_id, topic_code)
    VALUES (v_id, v_topic_code)
    ON CONFLICT DO NOTHING;
  END LOOP;
  
  -- Insert regulator relationships
  FOR v_regulator_code IN 
    SELECT jsonb_array_elements_text(COALESCE(v_payload->'regulator_codes', '[]'::jsonb))
    WHERE jsonb_array_elements_text IS NOT NULL 
      AND jsonb_array_elements_text != 'null'
  LOOP
    INSERT INTO kb_publication_regulator (publication_id, regulator_slug)
    VALUES (v_id, v_regulator_code)
    ON CONFLICT DO NOTHING;
  END LOOP;
  
  -- Insert regulation relationships
  FOR v_regulation_code IN 
    SELECT jsonb_array_elements_text(COALESCE(v_payload->'regulation_codes', '[]'::jsonb))
    WHERE jsonb_array_elements_text IS NOT NULL 
      AND jsonb_array_elements_text != 'null'
  LOOP
    INSERT INTO kb_publication_regulation (publication_id, regulation_slug)
    VALUES (v_id, v_regulation_code)
    ON CONFLICT DO NOTHING;
  END LOOP;
  
  -- Insert obligation relationships
  FOR v_obligation_code IN 
    SELECT jsonb_array_elements_text(COALESCE(v_payload->'obligation_codes', '[]'::jsonb))
    WHERE jsonb_array_elements_text IS NOT NULL 
      AND jsonb_array_elements_text != 'null'
  LOOP
    INSERT INTO kb_publication_obligation (publication_id, obligation_slug)
    VALUES (v_id, v_obligation_code)
    ON CONFLICT DO NOTHING;
  END LOOP;
  
  -- Insert process relationships
  FOR v_process_code IN 
    SELECT jsonb_array_elements_text(COALESCE(v_payload->'process_codes', '[]'::jsonb))
    WHERE jsonb_array_elements_text IS NOT NULL 
      AND jsonb_array_elements_text != 'null'
  LOOP
    INSERT INTO kb_publication_bfsi_process (publication_id, process_code)
    VALUES (v_id, v_process_code)
    ON CONFLICT DO NOTHING;
  END LOOP;
  
  -- Link vendor entities
  FOR v_vendor_name IN 
    SELECT jsonb_array_elements_text(COALESCE(v_payload->'vendor_names', '[]'::jsonb))
    WHERE jsonb_array_elements_text IS NOT NULL 
      AND jsonb_array_elements_text != 'null'
  LOOP
    INSERT INTO kb_publication_ag_vendor (publication_id, vendor_id)
    SELECT v_id, id FROM ag_vendor WHERE lower(slug) = lower(v_vendor_name)
    ON CONFLICT DO NOTHING;
  END LOOP;
  
  -- Link organization entities
  FOR v_org_name IN 
    SELECT jsonb_array_elements_text(COALESCE(v_payload->'organization_names', '[]'::jsonb))
    WHERE jsonb_array_elements_text IS NOT NULL 
      AND jsonb_array_elements_text != 'null'
  LOOP
    INSERT INTO kb_publication_bfsi_organization (publication_id, organization_id)
    SELECT v_id, id FROM bfsi_organization WHERE lower(slug) = lower(v_org_name)
    ON CONFLICT DO NOTHING;
  END LOOP;
  
  -- Mark queue item as approved
  UPDATE ingestion_queue 
  SET status = 'approved', 
      payload = jsonb_set(v_payload, '{publication_id}', to_jsonb(v_id::text))
  WHERE id = p_queue_id;
  
  RETURN v_id;
END;
$$;

-- ============================================================================
-- 8. Add primary_audience to source table
-- ============================================================================
-- This enables audience-first discovery: sources are tagged with their
-- primary audience, which helps the tagger calibrate relevance scores.

ALTER TABLE source ADD COLUMN primary_audience TEXT 
  REFERENCES kb_audience(value);

COMMENT ON COLUMN source.primary_audience IS 
  'Expected primary audience for content from this source. Used as hint during enrichment.';

-- Set primary_audience for known source patterns
-- Executive sources: strategy, business news, consulting
UPDATE source SET primary_audience = 'executive' 
WHERE slug IN ('ft', 'wsj', 'economist', 'mckinsey', 'bcg', 'hbr', 'bloomberg')
   OR name ILIKE '%financial times%'
   OR name ILIKE '%wall street%'
   OR name ILIKE '%economist%'
   OR name ILIKE '%mckinsey%'
   OR name ILIKE '%harvard business%';

-- Functional specialist sources: regulators, trade publications, vendors
UPDATE source SET primary_audience = 'functional_specialist'
WHERE slug IN ('dnb', 'afm', 'eba', 'ecb', 'bis', 'fsb', 'iosco', 'fatf')
   OR name ILIKE '%regulator%'
   OR name ILIKE '%compliance%'
   OR name ILIKE '%risk%'
   OR name ILIKE '%vendor%'
   OR url ILIKE '%regulator%'
   OR url ILIKE '%.gov%';

-- Engineer sources: technical blogs, GitHub, conferences
UPDATE source SET primary_audience = 'engineer'
WHERE slug IN ('github', 'hackernews', 'techcrunch', 'infoq', 'devto')
   OR name ILIKE '%developer%'
   OR name ILIKE '%engineering%'
   OR name ILIKE '%technical%'
   OR url ILIKE '%github%'
   OR url ILIKE '%dev.to%';

-- Researcher sources: academic, papers
UPDATE source SET primary_audience = 'researcher'
WHERE slug IN ('arxiv', 'ssrn', 'nber', 'scholar')
   OR name ILIKE '%academic%'
   OR name ILIKE '%research%'
   OR name ILIKE '%journal%'
   OR name ILIKE '%university%'
   OR url ILIKE '%arxiv%'
   OR url ILIKE '%ssrn%';

-- Default remaining to functional_specialist (most common for BFSI)
UPDATE source SET primary_audience = 'functional_specialist'
WHERE primary_audience IS NULL;

-- ============================================================================
-- 9. Update filter config (if exists)
-- ============================================================================

-- Update kb_filter_config to use 'audience' instead of 'role'
UPDATE kb_filter_config SET column_name = 'audience' WHERE column_name = 'role';

-- ============================================================================
-- 10. Comments
-- ============================================================================

COMMENT ON TABLE kb_audience IS 'Target audience types for publications (executive, functional_specialist, engineer, researcher)';
COMMENT ON COLUMN kb_publication.audience IS 'Primary target audience for this publication';
COMMENT ON COLUMN source.primary_audience IS 'Expected primary audience for content from this source';
