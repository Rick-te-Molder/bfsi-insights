-- Migration: Granular Pipeline Status Numbering System
-- See docs/architecture/pipeline-status-codes.md for full documentation

-- =============================================================================
-- STEP 1: Create status_lookup table
-- =============================================================================

CREATE TABLE public.status_lookup (
  code smallint PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text,
  category text NOT NULL CHECK (category IN ('discovery', 'enrichment', 'review', 'published', 'terminal')),
  is_terminal boolean DEFAULT false,
  sort_order smallint
);

-- Enable RLS
ALTER TABLE public.status_lookup ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Service role full access on status_lookup" ON public.status_lookup
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read access on status_lookup" ON public.status_lookup
  FOR SELECT TO authenticated USING (true);

-- Insert all status codes
INSERT INTO public.status_lookup (code, name, description, category, is_terminal, sort_order) VALUES
  -- 100s: Discovery
  (100, 'discovered', 'URL found in RSS/sitemap', 'discovery', false, 100),
  (110, 'to_fetch', 'Ready to fetch content', 'discovery', false, 110),
  (111, 'fetching', 'Fetch in progress', 'discovery', false, 111),
  (112, 'fetched', 'Content retrieved', 'discovery', false, 112),
  (120, 'to_score', 'Ready for relevance scoring', 'discovery', false, 120),
  (121, 'scoring', 'LLM/embedding scoring in progress', 'discovery', false, 121),
  (122, 'scored', 'Score assigned, ready to route', 'discovery', false, 122),
  
  -- 200s: Enrichment
  (200, 'pending_enrichment', 'In queue, awaiting first step', 'enrichment', false, 200),
  (210, 'to_summarize', 'Ready for summary generation', 'enrichment', false, 210),
  (211, 'summarizing', 'Summary agent working', 'enrichment', false, 211),
  (212, 'summarized', 'Summary complete', 'enrichment', false, 212),
  (220, 'to_tag', 'Ready for tagging', 'enrichment', false, 220),
  (221, 'tagging', 'Tag agent working', 'enrichment', false, 221),
  (222, 'tagged', 'Tags extracted', 'enrichment', false, 222),
  (230, 'to_thumbnail', 'Ready for thumbnail', 'enrichment', false, 230),
  (231, 'thumbnailing', 'Thumbnail agent working', 'enrichment', false, 231),
  (232, 'thumbnailed', 'Thumbnail generated', 'enrichment', false, 232),
  (240, 'enriched', 'All enrichment complete', 'enrichment', false, 240),
  
  -- 300s: Review
  (300, 'pending_review', 'Awaiting curator', 'review', false, 300),
  (310, 'in_review', 'Curator opened item', 'review', false, 310),
  (320, 'editing', 'Curator making changes', 'review', false, 320),
  (330, 'approved', 'Approved, ready to publish', 'review', false, 330),
  
  -- 400s: Published
  (400, 'published', 'Live on site', 'published', true, 400),
  (410, 'updated', 'Republished after edit', 'published', true, 410),
  
  -- 500s: Terminal/Error
  (500, 'failed', 'Technical error (retryable)', 'terminal', true, 500),
  (510, 'unreachable', 'URL 404/timeout', 'terminal', true, 510),
  (520, 'duplicate', 'Duplicate URL/content', 'terminal', true, 520),
  (530, 'irrelevant', 'Auto-filtered by scoring', 'terminal', true, 530),
  (540, 'rejected', 'Human rejected', 'terminal', true, 540);

-- =============================================================================
-- STEP 2: Create status_history table
-- =============================================================================

CREATE TABLE public.status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id uuid REFERENCES public.ingestion_queue(id) ON DELETE CASCADE,
  from_status smallint REFERENCES public.status_lookup(code),
  to_status smallint REFERENCES public.status_lookup(code) NOT NULL,
  changed_at timestamptz DEFAULT now(),
  changed_by text,  -- 'agent:summarize', 'user:rick', 'system:auto'
  changes jsonb,    -- {"field": {"old": "...", "new": "..."}}
  duration_ms int,  -- time spent in previous status
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.status_history ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Service role full access on status_history" ON public.status_history
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read access on status_history" ON public.status_history
  FOR SELECT TO authenticated USING (true);

-- Indexes
CREATE INDEX idx_status_history_queue ON public.status_history(queue_id);
CREATE INDEX idx_status_history_time ON public.status_history(changed_at DESC);
CREATE INDEX idx_status_history_to_status ON public.status_history(to_status);

-- =============================================================================
-- STEP 3: Add status_code column to ingestion_queue
-- =============================================================================

ALTER TABLE public.ingestion_queue ADD COLUMN IF NOT EXISTS status_code smallint;

-- Create index for new column
CREATE INDEX IF NOT EXISTS idx_queue_status_code ON public.ingestion_queue(status_code);

-- =============================================================================
-- STEP 4: Migrate existing status values
-- =============================================================================

UPDATE public.ingestion_queue 
SET status_code = CASE status
  WHEN 'pending' THEN 200      -- pending_enrichment
  WHEN 'queued' THEN 200       -- pending_enrichment (same as pending)
  WHEN 'processing' THEN 211   -- summarizing (most common processing state)
  WHEN 'enriched' THEN 300     -- pending_review
  WHEN 'approved' THEN 330     -- approved
  WHEN 'rejected' THEN 540     -- rejected
  WHEN 'failed' THEN 500       -- failed
  ELSE 200                     -- default to pending_enrichment
END
WHERE status_code IS NULL;

-- =============================================================================
-- STEP 5: Create helper function for status transitions
-- =============================================================================

CREATE OR REPLACE FUNCTION public.transition_status(
  p_queue_id uuid,
  p_new_status smallint,
  p_changed_by text DEFAULT 'system:auto',
  p_changes jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old_status smallint;
  v_old_updated_at timestamptz;
  v_duration_ms int;
BEGIN
  -- Get current status
  SELECT status_code, updated_at 
  INTO v_old_status, v_old_updated_at
  FROM public.ingestion_queue 
  WHERE id = p_queue_id;
  
  -- Calculate duration in previous status
  IF v_old_updated_at IS NOT NULL THEN
    v_duration_ms := EXTRACT(EPOCH FROM (now() - v_old_updated_at)) * 1000;
  END IF;
  
  -- Record history
  INSERT INTO public.status_history (queue_id, from_status, to_status, changed_by, changes, duration_ms)
  VALUES (p_queue_id, v_old_status, p_new_status, p_changed_by, p_changes, v_duration_ms);
  
  -- Update queue
  UPDATE public.ingestion_queue 
  SET status_code = p_new_status, updated_at = now()
  WHERE id = p_queue_id;
END;
$$;

-- =============================================================================
-- STEP 6: Create view for queue with status names
-- =============================================================================

CREATE OR REPLACE VIEW public.ingestion_queue_with_status
WITH (security_invoker = true)
AS
SELECT 
  q.*,
  sl.name as status_name,
  sl.category as status_category,
  sl.is_terminal
FROM public.ingestion_queue q
LEFT JOIN public.status_lookup sl ON sl.code = q.status_code;

-- =============================================================================
-- STEP 7: Insert initial history for existing items
-- =============================================================================

INSERT INTO public.status_history (queue_id, from_status, to_status, changed_by, changes)
SELECT 
  id,
  NULL,  -- no previous status
  status_code,
  'system:migration',
  jsonb_build_object('note', 'Initial migration from text status', 'old_status', status)
FROM public.ingestion_queue
WHERE status_code IS NOT NULL;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE public.status_lookup IS 'Lookup table for pipeline status codes. See docs/architecture/pipeline-status-codes.md';
COMMENT ON TABLE public.status_history IS 'History of all status transitions for audit and analytics';
COMMENT ON COLUMN public.ingestion_queue.status_code IS 'Numeric status code (see status_lookup table)';
COMMENT ON FUNCTION public.transition_status IS 'Helper function to transition status with automatic history tracking';
