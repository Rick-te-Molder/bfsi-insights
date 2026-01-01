-- Update approval function to insert taxonomy relationships

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
      thumbnail = COALESCE(v_queue.thumb_ref, thumbnail),
      last_edited = now()
    WHERE id = v_id;
  ELSE
    -- Insert new publication
    INSERT INTO kb_publication (
      slug, title, author, date_published, 
      source_url, source_name, source_domain,
      thumbnail, 
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
      v_queue.thumb_ref,
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
  END IF;
  
  -- Mark as approved
  UPDATE ingestion_queue 
  SET status = 'approved'
  WHERE id = p_queue_id;
  
  RETURN v_id;
END;
$$;