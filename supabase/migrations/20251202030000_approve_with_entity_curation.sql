-- ============================================================================
-- KB-134: Add entity curation to approve_from_queue
-- ============================================================================
-- Adds optional parameters for upserting approved vendors and organizations
-- during article approval process.
-- ============================================================================

-- Drop old function signature if exists (was uuid only)
DROP FUNCTION IF EXISTS approve_from_queue(uuid);

CREATE OR REPLACE FUNCTION approve_from_queue(
  p_queue_id uuid,
  p_approved_vendors text[] DEFAULT '{}',
  p_approved_organizations text[] DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  v_process_code text;
  v_vendor_name text;
  v_org_name text;
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
    DELETE FROM kb_publication_bfsi_process WHERE publication_id = v_id;
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
  
  -- Insert regulator relationships
  FOR v_regulator_code IN 
    SELECT jsonb_array_elements_text(COALESCE(v_payload->'regulator_codes', '[]'::jsonb))
  LOOP
    INSERT INTO kb_publication_regulator (publication_id, regulator_code)
    VALUES (v_id, v_regulator_code)
    ON CONFLICT DO NOTHING;
  END LOOP;
  
  -- Insert regulation relationships
  FOR v_regulation_code IN 
    SELECT jsonb_array_elements_text(COALESCE(v_payload->'regulation_codes', '[]'::jsonb))
  LOOP
    INSERT INTO kb_publication_regulation (publication_id, regulation_code)
    VALUES (v_id, v_regulation_code)
    ON CONFLICT DO NOTHING;
  END LOOP;
  
  -- Insert process relationships
  FOR v_process_code IN 
    SELECT jsonb_array_elements_text(COALESCE(v_payload->'process_codes', '[]'::jsonb))
  LOOP
    INSERT INTO kb_publication_bfsi_process (publication_id, process_code)
    VALUES (v_id, v_process_code)
    ON CONFLICT DO NOTHING;
  END LOOP;
  
  -- ============================================================================
  -- NEW: Upsert approved vendors to ag_vendor
  -- ============================================================================
  FOREACH v_vendor_name IN ARRAY p_approved_vendors
  LOOP
    INSERT INTO ag_vendor (name)
    VALUES (v_vendor_name)
    ON CONFLICT (name_lc) DO NOTHING;
  END LOOP;
  
  -- ============================================================================
  -- NEW: Upsert approved organizations to bfsi_organization
  -- ============================================================================
  FOREACH v_org_name IN ARRAY p_approved_organizations
  LOOP
    INSERT INTO bfsi_organization (organization_name)
    VALUES (v_org_name)
    ON CONFLICT DO NOTHING;
  END LOOP;
  
  -- Mark as approved
  UPDATE ingestion_queue 
  SET status = 'approved'
  WHERE id = p_queue_id;
  
  RETURN v_id;
END;
$$;

-- Add unique constraint on organization_name if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'bfsi_organization_name_unique'
  ) THEN
    ALTER TABLE bfsi_organization 
    ADD CONSTRAINT bfsi_organization_name_unique 
    UNIQUE (organization_name);
  END IF;
END $$;

COMMENT ON FUNCTION approve_from_queue(uuid, text[], text[]) IS 'Approves a queue item, creates publication, sets up taxonomy relationships, and optionally upserts new vendors/organizations';
