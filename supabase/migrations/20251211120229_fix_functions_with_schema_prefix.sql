-- ============================================================================
-- Fix functions to use fully qualified table names
-- ============================================================================
-- When search_path = '' is set, functions need explicit schema prefixes.
-- This fixes KB-205: dashboard shows only zeros.

-- Fix get_status_code_counts - add public. prefix to all table references
CREATE OR REPLACE FUNCTION public.get_status_code_counts()
RETURNS TABLE (
  code smallint,
  name text,
  category text,
  count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sl.code,
    sl.name,
    sl.category,
    COALESCE(counts.cnt, 0) AS count
  FROM public.status_lookup sl
  LEFT JOIN (
    SELECT 
      iq.status_code,
      COUNT(*) AS cnt
    FROM public.ingestion_queue iq
    WHERE iq.status_code IS NOT NULL
    GROUP BY iq.status_code
  ) counts ON sl.code = counts.status_code
  ORDER BY sl.sort_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- Fix update_updated_at_column - uses NEW which doesn't need schema
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- Fix get_ab_test_variant - add public. prefix
CREATE OR REPLACE FUNCTION public.get_ab_test_variant(p_agent_name TEXT)
RETURNS TABLE(test_id UUID, variant TEXT, prompt_version TEXT)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_test_id UUID;
  v_control_version TEXT;
  v_treatment_version TEXT;
  v_variant TEXT;
  v_prompt_version TEXT;
BEGIN
  -- Find active test for this agent
  SELECT t.id, t.control_version, t.treatment_version
  INTO v_test_id, v_control_version, v_treatment_version
  FROM public.prompt_ab_test t
  WHERE t.agent_name = p_agent_name
    AND t.status = 'running'
  LIMIT 1;

  IF v_test_id IS NULL THEN
    RETURN;
  END IF;

  -- Simple random assignment (50/50)
  IF random() < 0.5 THEN
    v_variant := 'control';
    v_prompt_version := v_control_version;
  ELSE
    v_variant := 'treatment';
    v_prompt_version := v_treatment_version;
  END IF;

  test_id := v_test_id;
  variant := v_variant;
  prompt_version := v_prompt_version;
  RETURN NEXT;
END;
$$;

-- Fix approve_from_queue - add public. prefix to all table references
CREATE OR REPLACE FUNCTION public.approve_from_queue(
  p_queue_id uuid,
  p_approved_vendors text[] DEFAULT '{}',
  p_approved_organizations text[] DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_queue_item RECORD;
  v_publication_id uuid;
  v_existing_pub_id uuid;
  v_payload jsonb;
  v_role text;
  v_industry text[];
  v_geography text[];
  v_topic text[];
  v_process text[];
  v_regulator text[];
  v_regulation text[];
  v_audience jsonb;
  v_vendor text;
  v_org text;
BEGIN
  -- Get queue item with all needed fields
  SELECT id, url, payload, status_code
  INTO v_queue_item
  FROM public.ingestion_queue
  WHERE id = p_queue_id;

  IF v_queue_item IS NULL THEN
    RAISE EXCEPTION 'Queue item % not found', p_queue_id;
  END IF;

  -- Check status (300 = PENDING_REVIEW)
  IF v_queue_item.status_code != 300 THEN
    RAISE EXCEPTION 'Queue item % is not pending review (status_code: %)', p_queue_id, v_queue_item.status_code;
  END IF;

  v_payload := v_queue_item.payload;

  -- Extract taxonomy arrays from payload (handle both array and object formats)
  v_industry := ARRAY(
    SELECT jsonb_array_elements_text(
      CASE 
        WHEN jsonb_typeof(v_payload->'industry') = 'array' THEN v_payload->'industry'
        ELSE '[]'::jsonb
      END
    )
  );
  
  v_geography := ARRAY(
    SELECT jsonb_array_elements_text(
      CASE 
        WHEN jsonb_typeof(v_payload->'geography') = 'array' THEN v_payload->'geography'
        ELSE '[]'::jsonb
      END
    )
  );
  
  v_topic := ARRAY(
    SELECT jsonb_array_elements_text(
      CASE 
        WHEN jsonb_typeof(v_payload->'topic') = 'array' THEN v_payload->'topic'
        ELSE '[]'::jsonb
      END
    )
  );

  v_process := ARRAY(
    SELECT jsonb_array_elements_text(
      CASE 
        WHEN jsonb_typeof(v_payload->'process') = 'array' THEN v_payload->'process'
        ELSE '[]'::jsonb
      END
    )
  );

  v_regulator := ARRAY(
    SELECT jsonb_array_elements_text(
      CASE 
        WHEN jsonb_typeof(v_payload->'regulator') = 'array' THEN v_payload->'regulator'
        ELSE '[]'::jsonb
      END
    )
  );

  v_regulation := ARRAY(
    SELECT jsonb_array_elements_text(
      CASE 
        WHEN jsonb_typeof(v_payload->'regulation') = 'array' THEN v_payload->'regulation'
        ELSE '[]'::jsonb
      END
    )
  );

  -- Extract audience (new format with scores)
  v_audience := v_payload->'audience';

  -- Check for existing publication with same URL
  SELECT id INTO v_existing_pub_id
  FROM public.kb_publication
  WHERE url = v_queue_item.url;

  IF v_existing_pub_id IS NOT NULL THEN
    -- Update existing publication
    UPDATE public.kb_publication SET
      title = v_payload->>'title',
      summary_short = v_payload->'summary'->>'short',
      summary_medium = v_payload->'summary'->>'medium',
      summary_long = v_payload->'summary'->>'long',
      audience = v_audience,
      industry = v_industry,
      geography = v_geography,
      topic = v_topic,
      process = v_process,
      regulator = v_regulator,
      regulation = v_regulation,
      obligation = (v_payload->>'obligation')::boolean,
      published_at = (v_payload->>'published_at')::timestamptz,
      thumbnail_url = v_payload->>'thumbnail_url',
      updated_at = now()
    WHERE id = v_existing_pub_id;
    
    v_publication_id := v_existing_pub_id;
  ELSE
    -- Insert new publication
    INSERT INTO public.kb_publication (
      url,
      title,
      summary_short,
      summary_medium,
      summary_long,
      audience,
      industry,
      geography,
      topic,
      process,
      regulator,
      regulation,
      obligation,
      published_at,
      thumbnail_url
    ) VALUES (
      v_queue_item.url,
      v_payload->>'title',
      v_payload->'summary'->>'short',
      v_payload->'summary'->>'medium',
      v_payload->'summary'->>'long',
      v_audience,
      v_industry,
      v_geography,
      v_topic,
      v_process,
      v_regulator,
      v_regulation,
      (v_payload->>'obligation')::boolean,
      (v_payload->>'published_at')::timestamptz,
      v_payload->>'thumbnail_url'
    )
    RETURNING id INTO v_publication_id;
  END IF;

  -- Upsert approved vendors
  FOREACH v_vendor IN ARRAY p_approved_vendors
  LOOP
    INSERT INTO public.kb_vendor (name, slug, status)
    VALUES (
      v_vendor,
      lower(regexp_replace(v_vendor, '[^a-zA-Z0-9]+', '-', 'g')),
      'approved'
    )
    ON CONFLICT (slug) DO UPDATE SET
      status = 'approved',
      updated_at = now();
  END LOOP;

  -- Upsert approved organizations
  FOREACH v_org IN ARRAY p_approved_organizations
  LOOP
    INSERT INTO public.kb_organization (name, slug, status)
    VALUES (
      v_org,
      lower(regexp_replace(v_org, '[^a-zA-Z0-9]+', '-', 'g')),
      'approved'
    )
    ON CONFLICT (slug) DO UPDATE SET
      status = 'approved',
      updated_at = now();
  END LOOP;

  -- Update queue item status to approved (330)
  UPDATE public.ingestion_queue
  SET 
    status = 'approved',
    status_code = 330,
    updated_at = now()
  WHERE id = p_queue_id;

  RETURN v_publication_id;
END;
$$;

-- Re-grant permissions
GRANT EXECUTE ON FUNCTION public.get_status_code_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_status_code_counts() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_ab_test_variant(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.approve_from_queue(uuid, text[], text[]) TO authenticated;
