-- Add regulator and regulation junction tables for publications
-- KB-148: Enable regulator/regulation filtering

-- ============================================================================
-- PART 1: Create junction tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS kb_publication_regulator (
  publication_id uuid REFERENCES kb_publication(id) ON DELETE CASCADE,
  regulator_code text NOT NULL,
  PRIMARY KEY (publication_id, regulator_code)
);

CREATE TABLE IF NOT EXISTS kb_publication_regulation (
  publication_id uuid REFERENCES kb_publication(id) ON DELETE CASCADE,
  regulation_code text NOT NULL,
  PRIMARY KEY (publication_id, regulation_code)
);

-- Add indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_kb_pub_regulator_code ON kb_publication_regulator(regulator_code);
CREATE INDEX IF NOT EXISTS idx_kb_pub_regulation_code ON kb_publication_regulation(regulation_code);

-- Grant permissions
GRANT SELECT ON kb_publication_regulator TO anon, authenticated;
GRANT SELECT ON kb_publication_regulation TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON kb_publication_regulator TO authenticated;
GRANT INSERT, UPDATE, DELETE ON kb_publication_regulation TO authenticated;

-- ============================================================================
-- PART 2: Update kb_publication_pretty view to include regulators/regulations
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
  p.role,
  p.content_type,
  p.geography,
  p.use_cases,
  p.agentic_capabilities,
  p.status,
  -- Existing arrays
  COALESCE(
    (SELECT array_agg(i.industry_code) FROM kb_publication_bfsi_industry i WHERE i.publication_id = p.id),
    ARRAY[]::text[]
  ) AS industries,
  COALESCE(
    (SELECT array_agg(t.topic_code) FROM kb_publication_bfsi_topic t WHERE t.publication_id = p.id),
    ARRAY[]::text[]
  ) AS topics,
  -- Single values for backwards compatibility
  (SELECT i.industry_code FROM kb_publication_bfsi_industry i WHERE i.publication_id = p.id LIMIT 1) AS industry,
  (SELECT t.topic_code FROM kb_publication_bfsi_topic t WHERE t.publication_id = p.id LIMIT 1) AS topic,
  -- NEW: Regulator and regulation arrays
  COALESCE(
    (SELECT array_agg(r.regulator_code) FROM kb_publication_regulator r WHERE r.publication_id = p.id),
    ARRAY[]::text[]
  ) AS regulators,
  COALESCE(
    (SELECT array_agg(r.regulation_code) FROM kb_publication_regulation r WHERE r.publication_id = p.id),
    ARRAY[]::text[]
  ) AS regulations
FROM kb_publication p;

GRANT SELECT ON kb_publication_pretty TO anon, authenticated;

-- ============================================================================
-- PART 2.5: Add filter configuration for regulator/regulation
-- ============================================================================

INSERT INTO ref_filter_config (column_name, display_label, filter_type, sort_order, description) VALUES
  ('regulator', 'Regulator', 'multi-select', 60, 'Regulatory body (e.g., ECB, FCA, SEC)'),
  ('regulation', 'Regulation', 'multi-select', 70, 'Specific regulation (e.g., DORA, GDPR, MiFID II)')
ON CONFLICT (column_name) DO UPDATE SET
  display_label = EXCLUDED.display_label,
  filter_type = EXCLUDED.filter_type,
  sort_order = EXCLUDED.sort_order,
  description = EXCLUDED.description;

-- ============================================================================
-- PART 3: Update approve_from_queue function to insert regulator/regulation
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
  v_thumb_bucket text;
  v_thumb_path text;
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
      last_edited = now()
    WHERE id = v_id;
    
    -- Clear existing relationships for re-tagging
    DELETE FROM kb_publication_bfsi_industry WHERE publication_id = v_id;
    DELETE FROM kb_publication_bfsi_topic WHERE publication_id = v_id;
    DELETE FROM kb_publication_regulator WHERE publication_id = v_id;
    DELETE FROM kb_publication_regulation WHERE publication_id = v_id;
  ELSE
    -- Insert new publication
    INSERT INTO kb_publication (
      slug, title, author, date_published, 
      source_url, source_name, source_domain,
      thumbnail_bucket, thumbnail_path,
      summary_short, summary_medium, summary_long,
      role, content_type,
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
      CASE 
        WHEN (v_payload->'persona_scores'->>'executive')::float > 0.7 THEN 'executive'
        WHEN (v_payload->'persona_scores'->>'professional')::float > 0.7 THEN 'professional'
        ELSE 'researcher'
      END,
      'article',
      'published',
      p_queue_id
    )
    RETURNING id INTO v_id;
  END IF;
  
  -- Insert industry relationships
  FOR v_industry_code IN 
    SELECT jsonb_array_elements_text(COALESCE(v_payload->'industry_codes', '[]'::jsonb))
  LOOP
    INSERT INTO kb_publication_bfsi_industry (publication_id, industry_code)
    VALUES (v_id, v_industry_code)
    ON CONFLICT DO NOTHING;
  END LOOP;
  
  -- Insert topic relationships  
  FOR v_topic_code IN 
    SELECT jsonb_array_elements_text(COALESCE(v_payload->'topic_codes', '[]'::jsonb))
  LOOP
    INSERT INTO kb_publication_bfsi_topic (publication_id, topic_code)
    VALUES (v_id, v_topic_code)
    ON CONFLICT DO NOTHING;
  END LOOP;
  
  -- Insert regulator relationships (NEW)
  FOR v_regulator_code IN 
    SELECT jsonb_array_elements_text(COALESCE(v_payload->'regulator_codes', '[]'::jsonb))
  LOOP
    INSERT INTO kb_publication_regulator (publication_id, regulator_code)
    VALUES (v_id, v_regulator_code)
    ON CONFLICT DO NOTHING;
  END LOOP;
  
  -- Insert regulation relationships (NEW)
  FOR v_regulation_code IN 
    SELECT jsonb_array_elements_text(COALESCE(v_payload->'regulation_codes', '[]'::jsonb))
  LOOP
    INSERT INTO kb_publication_regulation (publication_id, regulation_code)
    VALUES (v_id, v_regulation_code)
    ON CONFLICT DO NOTHING;
  END LOOP;
  
  -- Mark as approved
  UPDATE ingestion_queue 
  SET status = 'approved'
  WHERE id = p_queue_id;
  
  RETURN v_id;
END;
$$;
