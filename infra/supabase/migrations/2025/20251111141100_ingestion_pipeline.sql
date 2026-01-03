-- Migration: Forward-compatible ingestion pipeline
-- Phase 1: Simple queue with future-ready architecture
-- Run date: 2025-11-11

-- ============================================================================
-- PART 0: Enable required extensions
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- PART 1: Rename problematic columns
-- ============================================================================

-- Rename content_type_new to content_type in production table
ALTER TABLE kb_resource 
RENAME COLUMN content_type_new TO content_type;

-- Update the view to use renamed column
CREATE OR REPLACE VIEW kb_resource_pretty AS
SELECT 
  id, slug, title,
  author AS authors,
  publication_date AS date_published,
  date_added, last_edited,
  url, source_name, source_domain,
  thumbnail, summary_short, summary_medium, summary_long,
  notes AS note, role, content_type, jurisdiction,
  industry, topic, use_cases, agentic_capabilities,
  tags, status, domain_category AS internal_notes
FROM kb_resource;

-- ============================================================================
-- PART 2: Enhance production table for future compatibility
-- ============================================================================

ALTER TABLE kb_resource 
ADD COLUMN IF NOT EXISTS canonical_url text,
ADD COLUMN IF NOT EXISTS content_hash text,
ADD COLUMN IF NOT EXISTS origin_queue_id uuid,
ADD COLUMN IF NOT EXISTS origin_stg_id uuid,
ADD COLUMN IF NOT EXISTS embedding vector(1536),
ADD COLUMN IF NOT EXISTS raw_ref text,
ADD COLUMN IF NOT EXISTS etag text,
ADD COLUMN IF NOT EXISTS last_modified timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_resource_canonical_url 
ON kb_resource(canonical_url) WHERE canonical_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_resource_content_hash 
ON kb_resource(content_hash) WHERE content_hash IS NOT NULL;

COMMENT ON COLUMN kb_resource.canonical_url IS 'Normalized URL for deduplication';
COMMENT ON COLUMN kb_resource.content_hash IS 'SHA-256 hash of content for idempotency';
COMMENT ON COLUMN kb_resource.origin_queue_id IS 'References ingestion_queue.id';
COMMENT ON COLUMN kb_resource.origin_stg_id IS 'References kb_resource_stg.id (future)';
COMMENT ON COLUMN kb_resource.raw_ref IS 'Supabase Storage key for raw HTML/PDF';

-- ============================================================================
-- PART 3: Create ingestion queue (active now)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ingestion_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Core identifiers
  url text NOT NULL,
  url_norm text GENERATED ALWAYS AS (
    lower(regexp_replace(url, '[?#].*$', ''))
  ) STORED,
  content_hash text,
  
  -- Workflow
  status text CHECK (status IN ('pending', 'approved', 'rejected', 'ingested')) DEFAULT 'pending',
  content_type text DEFAULT 'resource',
  
  -- Payload (structured JSON)
  payload jsonb NOT NULL,
  payload_schema_version int NOT NULL DEFAULT 1,
  
  -- Storage references
  raw_ref text,
  thumb_ref text,
  
  -- HTTP metadata
  etag text,
  last_modified timestamptz,
  
  -- Timestamps
  discovered_at timestamptz DEFAULT now(),
  fetched_at timestamptz,
  reviewed_at timestamptz,
  
  -- Audit
  reviewer uuid,
  rejection_reason text,
  
  -- AI metadata
  prompt_version text,
  model_id text,
  agent_metadata jsonb,
  
  -- Future migration link
  stg_id uuid
);

CREATE UNIQUE INDEX idx_queue_url_norm ON ingestion_queue(url_norm);
CREATE UNIQUE INDEX idx_queue_content_hash ON ingestion_queue(content_hash) WHERE content_hash IS NOT NULL;

CREATE INDEX idx_queue_status ON ingestion_queue(status);
CREATE INDEX idx_queue_content_type ON ingestion_queue(content_type);
CREATE INDEX idx_queue_discovered_at ON ingestion_queue(discovered_at DESC);
CREATE INDEX idx_queue_reviewed_at ON ingestion_queue(reviewed_at DESC) WHERE reviewed_at IS NOT NULL;

COMMENT ON TABLE ingestion_queue IS 'Lightweight queue for discovery, enrichment, and review';
COMMENT ON COLUMN ingestion_queue.payload IS 'JSON: {title, authors, published_at, source, summary: {short, medium, long}, tags: {...}}';

-- ============================================================================
-- PART 4: Create staging table (empty now, ready for future)
-- ============================================================================

DROP TABLE IF EXISTS kb_resource_stg CASCADE;

CREATE TABLE kb_resource_stg (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Discovery
  url text NOT NULL,
  url_norm text GENERATED ALWAYS AS (
    lower(regexp_replace(url, '[?#].*$', ''))
  ) STORED,
  source text,
  discovered_at timestamptz DEFAULT now(),
  
  -- Fetch
  fetched_at timestamptz,
  mime text,
  http_status int,
  etag text,
  last_modified timestamptz,
  content_hash text,
  
  -- Parse
  title_raw text,
  authors text[],
  published_at timestamptz,
  text_extracted text,
  og_image_url text,
  
  -- Enrich
  summary jsonb,
  tags jsonb,
  thumb_asset_id text,
  embedding vector(1536),
  
  -- Quality
  quality_score numeric,
  spam_score numeric,
  
  -- Workflow
  status text CHECK (status IN (
    'discovered', 'fetched', 'parsed', 'enriched', 
    'proposed', 'approved', 'rejected', 'ingested'
  )) DEFAULT 'proposed',
  
  -- Audit
  reviewer uuid,
  decision_note text,
  decided_at timestamptz,
  ingested_into uuid,
  
  -- Metadata
  prompt_version text,
  model_id text,
  agent_metadata jsonb,
  
  -- Storage refs
  raw_ref text,
  thumb_ref text,
  
  -- Traceability
  origin_queue_id uuid
);

CREATE UNIQUE INDEX idx_stg_url_norm ON kb_resource_stg(url_norm);
CREATE UNIQUE INDEX idx_stg_content_hash ON kb_resource_stg(content_hash) WHERE content_hash IS NOT NULL;

CREATE INDEX idx_stg_status ON kb_resource_stg(status);
CREATE INDEX idx_stg_discovered_at ON kb_resource_stg(discovered_at DESC);
CREATE INDEX idx_stg_quality_score ON kb_resource_stg(quality_score DESC) WHERE quality_score IS NOT NULL;

COMMENT ON TABLE kb_resource_stg IS 'Staging table for future multi-stage pipeline';

-- ============================================================================
-- PART 5: Create approve function
-- ============================================================================
-- SECURITY: ADMIN-ONLY function using SECURITY DEFINER + auth.uid() audit trail
-- Access: Any authenticated user (future: add is_admin() check)
-- Audit: Logs reviewer = auth.uid() for accountability

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
  SELECT * INTO v_queue 
  FROM ingestion_queue 
  WHERE id = p_queue_id AND status = 'pending' 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Queue item % not found or not pending', p_queue_id;
  END IF;
  
  v_payload := v_queue.payload;
  
  -- Generate slug
  v_slug := lower(regexp_replace(
    regexp_replace(v_payload->>'title', '[^a-zA-Z0-9\\s-]', '', 'g'),
    '\\s+', '-', 'g'
  ));
  v_slug := substring(v_slug from 1 for 100);
  
  -- Ensure unique slug
  WHILE EXISTS (SELECT 1 FROM kb_resource WHERE slug = v_slug) LOOP
    v_slug := v_slug || '-' || substring(md5(random()::text) from 1 for 6);
  END LOOP;
  
  -- Check for existing (soft dedupe)
  SELECT id INTO v_id FROM kb_resource WHERE canonical_url = v_queue.url_norm;
  
  IF v_id IS NOT NULL THEN
    -- Update existing
    UPDATE kb_resource SET
      title = v_payload->>'title',
      author = array_to_string(
        (SELECT array_agg(value::text) FROM jsonb_array_elements_text(v_payload->'authors')), ', '
      ),
      publication_date = (v_payload->>'published_at')::timestamptz,
      summary_short = v_payload->'summary'->>'short',
      summary_medium = v_payload->'summary'->>'medium',
      summary_long = v_payload->'summary'->>'long',
      tags = COALESCE(
        (SELECT array_agg(value::text) FROM jsonb_array_elements_text(v_payload->'tags'->'topics')),
        ARRAY[]::text[]
      ),
      role = v_payload->'tags'->>'role',
      content_type = v_payload->'tags'->>'content_type',
      industry = v_payload->'tags'->>'industry',
      topic = v_payload->'tags'->>'topic',
      jurisdiction = v_payload->'tags'->>'jurisdiction',
      use_cases = v_payload->'tags'->>'use_cases',
      agentic_capabilities = v_payload->'tags'->>'agentic_capabilities',
      thumbnail = COALESCE(v_queue.thumb_ref, thumbnail),
      content_hash = v_queue.content_hash,
      last_edited = now()
    WHERE id = v_id;
  ELSE
    -- Insert new
    INSERT INTO kb_resource (
      slug, title, author, publication_date, url,
      source_name, thumbnail, 
      summary_short, summary_medium, summary_long,
      tags, role, content_type, industry, topic,
      use_cases, agentic_capabilities, jurisdiction,
      status, canonical_url, content_hash, origin_queue_id
    )
    VALUES (
      v_slug,
      v_payload->>'title',
      array_to_string(
        (SELECT array_agg(value::text) FROM jsonb_array_elements_text(v_payload->'authors')), ', '
      ),
      (v_payload->>'published_at')::timestamptz,
      v_queue.url,
      v_payload->>'source',
      v_queue.thumb_ref,
      v_payload->'summary'->>'short',
      v_payload->'summary'->>'medium',
      v_payload->'summary'->>'long',
      COALESCE(
        (SELECT array_agg(value::text) FROM jsonb_array_elements_text(v_payload->'tags'->'topics')),
        ARRAY[]::text[]
      ),
      v_payload->'tags'->>'role',
      v_payload->'tags'->>'content_type',
      v_payload->'tags'->>'industry',
      v_payload->'tags'->>'topic',
      v_payload->'tags'->>'use_cases',
      v_payload->'tags'->>'agentic_capabilities',
      v_payload->'tags'->>'jurisdiction',
      'published',
      v_queue.url_norm,
      v_queue.content_hash,
      p_queue_id
    )
    RETURNING id INTO v_id;
  END IF;
  
  -- Mark as approved
  UPDATE ingestion_queue
  SET status = 'approved', reviewed_at = now(), reviewer = auth.uid()
  WHERE id = p_queue_id;
  
  RETURN v_id;
END $$;

-- ============================================================================
-- PART 6: Create reject function
-- ============================================================================
-- SECURITY: ADMIN-ONLY function using SECURITY DEFINER + auth.uid() audit trail
-- Access: Any authenticated user (future: add is_admin() check)
-- Audit: Logs reviewer = auth.uid() and rejection_reason

CREATE OR REPLACE FUNCTION reject_from_queue(p_queue_id uuid, p_reason text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE ingestion_queue
  SET status = 'rejected', reviewed_at = now(), reviewer = auth.uid(), rejection_reason = p_reason
  WHERE id = p_queue_id AND status = 'pending';
  
  RETURN FOUND;
END $$;

-- ============================================================================
-- PART 7: Create review queue view
-- ============================================================================

CREATE OR REPLACE VIEW ingestion_review_queue AS
SELECT 
  id, url, content_type,
  payload->>'title' AS title,
  payload->'authors' AS authors,
  payload->>'published_at' AS published_at,
  payload->'summary' AS summary,
  payload->'tags' AS tags,
  thumb_ref, discovered_at, fetched_at, status,
  prompt_version, model_id
FROM ingestion_queue
WHERE status = 'pending'
ORDER BY discovered_at DESC;

-- ============================================================================
-- PART 8: Create restore function for rejected items
-- ============================================================================
-- SECURITY: ADMIN-ONLY function using SECURITY DEFINER
-- Access: Any authenticated user (future: add is_admin() check)
-- Audit: Appends note to rejection_reason history

CREATE OR REPLACE FUNCTION restore_from_rejection(p_queue_id uuid, p_note text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Reset rejected item back to pending for re-review
  UPDATE ingestion_queue
  SET 
    status = 'pending',
    reviewed_at = NULL,
    reviewer = NULL,
    rejection_reason = CASE 
      WHEN p_note IS NOT NULL THEN rejection_reason || ' | RESTORED: ' || p_note
      ELSE rejection_reason || ' | RESTORED'
    END
  WHERE id = p_queue_id AND status = 'rejected';
  
  RETURN FOUND;
END $$;

COMMENT ON FUNCTION restore_from_rejection IS 'Restores a rejected item back to pending status for re-review';

-- ============================================================================
-- PART 9: PDCA Cycle - Analytics & Prompt Management
-- ============================================================================

-- Track prompt versions and their performance
CREATE TABLE IF NOT EXISTS prompt_versions (
  id SERIAL PRIMARY KEY,
  version text UNIQUE NOT NULL,
  prompt_text text NOT NULL,
  created_at timestamptz DEFAULT NOW(),
  created_by uuid REFERENCES auth.users(id),
  is_active boolean DEFAULT false,
  notes text
);

-- Track rejection patterns for continuous improvement
CREATE TABLE IF NOT EXISTS rejection_analytics (
  id SERIAL PRIMARY KEY,
  rejection_reason text,
  rejection_category text, -- 'not-bfsi-relevant', 'low-quality', 'duplicate', 'wrong-topic', 'other'
  queue_item_id uuid REFERENCES ingestion_queue(id),
  prompt_version text,
  discovered_source text,
  industry text,
  topic text,
  created_at timestamptz DEFAULT NOW()
);

CREATE INDEX idx_rejection_analytics_category ON rejection_analytics(rejection_category);
CREATE INDEX idx_rejection_analytics_prompt ON rejection_analytics(prompt_version);
CREATE INDEX idx_rejection_analytics_created ON rejection_analytics(created_at DESC);

-- Function to automatically log rejections for PDCA analysis
CREATE OR REPLACE FUNCTION log_rejection_analytics()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'rejected' AND OLD.status = 'pending' THEN
    INSERT INTO rejection_analytics (
      rejection_reason,
      rejection_category,
      queue_item_id,
      prompt_version,
      discovered_source,
      industry,
      topic
    ) VALUES (
      NEW.rejection_reason,
      -- Auto-categorize based on keywords in rejection reason
      CASE 
        WHEN NEW.rejection_reason ILIKE '%not relevant%' OR 
             NEW.rejection_reason ILIKE '%little to do with bfsi%' OR
             NEW.rejection_reason ILIKE '%not bfsi%' THEN 'not-bfsi-relevant'
        WHEN NEW.rejection_reason ILIKE '%quality%' OR 
             NEW.rejection_reason ILIKE '%poor%' THEN 'low-quality'
        WHEN NEW.rejection_reason ILIKE '%duplicate%' THEN 'duplicate'
        WHEN NEW.rejection_reason ILIKE '%wrong topic%' OR
             NEW.rejection_reason ILIKE '%off-topic%' THEN 'wrong-topic'
        ELSE 'other'
      END,
      NEW.id,
      NEW.prompt_version,
      NEW.payload->>'source',
      NEW.payload->'tags'->>'industry',
      NEW.payload->'tags'->>'topic'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_rejections
AFTER UPDATE ON ingestion_queue
FOR EACH ROW
EXECUTE FUNCTION log_rejection_analytics();

COMMENT ON TABLE prompt_versions IS 'Track prompt versions for A/B testing and performance monitoring';
COMMENT ON TABLE rejection_analytics IS 'Analyze rejection patterns for PDCA continuous improvement';

-- ============================================================================
-- PART 10: Grant permissions
-- ============================================================================
-- SECURITY NOTE: Admin functions currently granted to ANY authenticated user
-- FUTURE: Add app_roles table and restrict to admin/editor roles only

GRANT SELECT ON ingestion_review_queue TO authenticated;
GRANT EXECUTE ON FUNCTION approve_from_queue TO authenticated;
GRANT EXECUTE ON FUNCTION reject_from_queue TO authenticated;
GRANT EXECUTE ON FUNCTION restore_from_rejection TO authenticated;

-- Migration complete!