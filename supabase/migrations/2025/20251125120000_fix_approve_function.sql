-- Fix approve_from_queue function to use kb_publication instead of kb_resource
-- and accept 'enriched' status instead of 'pending'

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
BEGIN
  -- Select queue item with 'enriched' status
  SELECT * INTO v_queue 
  FROM ingestion_queue 
  WHERE id = p_queue_id AND status = 'enriched' 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Queue item % not found or not enriched', p_queue_id;
  END IF;
  
  v_payload := v_queue.payload;
  
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
      author = v_payload->>'authors',
      date_published = (v_payload->>'published_at')::timestamptz,
      summary_short = v_payload->'summary'->>'short',
      summary_medium = v_payload->'summary'->>'medium',
      summary_long = v_payload->'summary'->>'long',
      role = COALESCE(v_payload->'persona_scores'->>'primary', 'professional'),
      content_type = COALESCE(v_payload->>'content_type', 'article'),
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
      v_payload->>'authors',
      (v_payload->>'published_at')::timestamptz,
      v_queue.url,
      v_payload->>'source',
      (regexp_match(v_queue.url, 'https?://([^/]+)'))[1],
      v_queue.thumb_ref,
      v_payload->'summary'->>'short',
      v_payload->'summary'->>'medium',
      v_payload->'summary'->>'long',
      COALESCE(v_payload->'persona_scores'->>'primary', 'professional'),
      COALESCE(v_payload->>'content_type', 'article'),
      'published',
      p_queue_id
    )
    RETURNING id INTO v_id;
  END IF;
  
  -- Mark queue item as approved
  UPDATE ingestion_queue 
  SET 
    status = 'approved',
    reviewed_at = now(),
    reviewer_id = auth.uid()
  WHERE id = p_queue_id;
  
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION approve_from_queue IS 'Approves an enriched queue item and creates/updates a publication in kb_publication';