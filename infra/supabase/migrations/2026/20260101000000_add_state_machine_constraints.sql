-- Migration: Add State Machine Constraints
-- KB-XXX: Phase 2 Task 1.1 - Formal state machine with validation
-- Database-driven state machine using state_transitions table

-- =============================================================================
-- STEP 1: Create state_transitions table
-- =============================================================================

CREATE TABLE public.state_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_status smallint NOT NULL REFERENCES public.status_lookup(code),
  to_status smallint NOT NULL REFERENCES public.status_lookup(code),
  is_manual boolean DEFAULT false,
  description text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(from_status, to_status, is_manual)
);

COMMENT ON TABLE public.state_transitions IS 'Valid state transitions for pipeline state machine';
COMMENT ON COLUMN public.state_transitions.is_manual IS 'True if transition requires manual override (e.g., re-enrichment)';

-- Enable RLS
ALTER TABLE public.state_transitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on state_transitions" ON public.state_transitions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read access on state_transitions" ON public.state_transitions
  FOR SELECT TO authenticated USING (true);

-- Create indexes
CREATE INDEX idx_state_transitions_from ON public.state_transitions(from_status);
CREATE INDEX idx_state_transitions_to ON public.state_transitions(to_status);

-- =============================================================================
-- STEP 2: Insert all valid state transitions
-- =============================================================================

-- Normal transitions (automatic)
INSERT INTO public.state_transitions (from_status, to_status, is_manual, description) VALUES
  -- Discovery phase (100s)
  (100, 110, false, 'discovered → to_fetch'),
  (100, 520, false, 'discovered → duplicate'),
  (100, 530, false, 'discovered → irrelevant'),
  (110, 111, false, 'to_fetch → fetching'),
  (110, 510, false, 'to_fetch → unreachable'),
  (111, 112, false, 'fetching → fetched'),
  (111, 510, false, 'fetching → unreachable'),
  (111, 500, false, 'fetching → failed'),
  (112, 120, false, 'fetched → to_score'),
  (112, 200, false, 'fetched → pending_enrichment (skip scoring)'),
  (120, 121, false, 'to_score → scoring'),
  (121, 122, false, 'scoring → scored'),
  (121, 500, false, 'scoring → failed'),
  (122, 200, false, 'scored → pending_enrichment'),
  (122, 530, false, 'scored → irrelevant'),
  
  -- Enrichment phase (200s)
  (200, 210, false, 'pending_enrichment → to_summarize'),
  (210, 211, false, 'to_summarize → summarizing'),
  (211, 212, false, 'summarizing → summarized'),
  (211, 500, false, 'summarizing → failed'),
  (211, 540, false, 'summarizing → rejected (bad data)'),
  (212, 220, false, 'summarized → to_tag'),
  (220, 221, false, 'to_tag → tagging'),
  (221, 222, false, 'tagging → tagged'),
  (221, 500, false, 'tagging → failed'),
  (221, 540, false, 'tagging → rejected'),
  (222, 230, false, 'tagged → to_thumbnail'),
  (230, 231, false, 'to_thumbnail → thumbnailing'),
  (231, 232, false, 'thumbnailing → thumbnailed'),
  (231, 500, false, 'thumbnailing → failed'),
  (232, 240, false, 'thumbnailed → enriched'),
  (240, 300, false, 'enriched → pending_review'),
  
  -- Review phase (300s)
  (300, 310, false, 'pending_review → in_review'),
  (300, 400, false, 'pending_review → published (auto-approve)'),
  (300, 540, false, 'pending_review → rejected'),
  (310, 320, false, 'in_review → editing'),
  (310, 400, false, 'in_review → published (approve)'),
  (310, 540, false, 'in_review → rejected'),
  (320, 400, false, 'editing → published (approve)'),
  (320, 540, false, 'editing → rejected'),
  
  -- Published (400s)
  (400, 410, false, 'published → updated'),
  (400, 540, false, 'published → rejected (unpublish)'),
  (410, 400, false, 'updated → published'),
  
  -- Terminal states - retry transitions
  (500, 110, false, 'failed → to_fetch (retry)'),
  (500, 210, false, 'failed → to_summarize (retry)'),
  (500, 220, false, 'failed → to_tag (retry)'),
  (500, 230, false, 'failed → to_thumbnail (retry)'),
  (500, 599, false, 'failed → dead_letter (give up)'),
  (510, 110, false, 'unreachable → to_fetch (retry)');

-- Manual transitions (require manual override)
INSERT INTO public.state_transitions (from_status, to_status, is_manual, description) VALUES
  -- Re-enrichment from review states
  (300, 210, true, 'pending_review → to_summarize (re-enrich)'),
  (300, 220, true, 'pending_review → to_tag (re-enrich)'),
  (300, 230, true, 'pending_review → to_thumbnail (re-enrich)'),
  (310, 210, true, 'in_review → to_summarize (re-enrich)'),
  (310, 220, true, 'in_review → to_tag (re-enrich)'),
  (310, 230, true, 'in_review → to_thumbnail (re-enrich)'),
  (320, 210, true, 'editing → to_summarize (re-enrich)'),
  (320, 220, true, 'editing → to_tag (re-enrich)'),
  (320, 230, true, 'editing → to_thumbnail (re-enrich)'),
  
  -- Re-enrichment from published states
  (400, 210, true, 'published → to_summarize (re-enrich)'),
  (400, 220, true, 'published → to_tag (re-enrich)'),
  (400, 230, true, 'published → to_thumbnail (re-enrich)'),
  (400, 300, true, 'published → pending_review (back to review)'),
  (410, 210, true, 'updated → to_summarize (re-enrich)'),
  (410, 220, true, 'updated → to_tag (re-enrich)'),
  (410, 230, true, 'updated → to_thumbnail (re-enrich)'),
  (410, 300, true, 'updated → pending_review (back to review)');

-- =============================================================================
-- STEP 3: Create function to validate state transitions
-- =============================================================================

CREATE OR REPLACE FUNCTION public.validate_state_transition(
  p_from_status smallint,
  p_to_status smallint,
  p_is_manual boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- Allow same-state transitions (idempotent)
  IF p_from_status = p_to_status THEN
    RETURN true;
  END IF;

  -- Check if transition exists in state_transitions table
  RETURN EXISTS (
    SELECT 1 FROM public.state_transitions
    WHERE from_status = p_from_status
      AND to_status = p_to_status
      AND (is_manual = false OR p_is_manual = true)
  );
END;
$$;

COMMENT ON FUNCTION public.validate_state_transition IS 'Validates state transitions according to pipeline state machine';

-- =============================================================================
-- STEP 4: Create trigger to enforce state transitions
-- =============================================================================

CREATE OR REPLACE FUNCTION public.enforce_state_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_is_manual boolean;
BEGIN
  -- Skip validation if status_code is NULL (initial insert)
  IF OLD.status_code IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if this is a manual transition (has _manual_override flag in payload)
  v_is_manual := COALESCE((NEW.payload->>'_manual_override')::boolean, false);

  -- Validate transition
  IF NOT public.validate_state_transition(OLD.status_code, NEW.status_code, v_is_manual) THEN
    RAISE EXCEPTION 'Invalid state transition: % → % (manual: %)', 
      OLD.status_code, NEW.status_code, v_is_manual
      USING HINT = 'Check state machine definition in docs/architecture/pipeline-state-machine.md';
  END IF;

  RETURN NEW;
END;
$$;

-- Add trigger to ingestion_queue
DROP TRIGGER IF EXISTS enforce_state_transition_trigger ON public.ingestion_queue;
CREATE TRIGGER enforce_state_transition_trigger
  BEFORE UPDATE OF status_code ON public.ingestion_queue
  FOR EACH ROW
  WHEN (OLD.status_code IS DISTINCT FROM NEW.status_code)
  EXECUTE FUNCTION public.enforce_state_transition();

COMMENT ON TRIGGER enforce_state_transition_trigger ON public.ingestion_queue IS 
  'Enforces valid state transitions according to pipeline state machine';

-- =============================================================================
-- STEP 5: Add blocker field for explicit blocker tracking
-- =============================================================================

ALTER TABLE public.ingestion_queue 
  ADD COLUMN IF NOT EXISTS blocker text,
  ADD COLUMN IF NOT EXISTS blocker_details jsonb;

CREATE INDEX IF NOT EXISTS idx_queue_blocker ON public.ingestion_queue(blocker) 
  WHERE blocker IS NOT NULL;

COMMENT ON COLUMN public.ingestion_queue.blocker IS 'Explicit blocker reason (e.g., "missing_content", "rate_limit", "manual_review_required")';
COMMENT ON COLUMN public.ingestion_queue.blocker_details IS 'Additional context about the blocker';

-- =============================================================================
-- STEP 6: Update transition_status function to use validation
-- =============================================================================

CREATE OR REPLACE FUNCTION public.transition_status(
  p_queue_id uuid,
  p_new_status smallint,
  p_changed_by text DEFAULT 'system:auto',
  p_changes jsonb DEFAULT NULL,
  p_is_manual boolean DEFAULT false
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
  
  -- Validate transition
  IF v_old_status IS NOT NULL AND NOT public.validate_state_transition(v_old_status, p_new_status, p_is_manual) THEN
    RAISE EXCEPTION 'Invalid state transition: % → % (manual: %)', 
      v_old_status, p_new_status, p_is_manual;
  END IF;
  
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
-- STEP 7: Add helper function to get valid next states
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_valid_next_states(
  p_current_status smallint,
  p_include_manual boolean DEFAULT false
)
RETURNS smallint[]
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- Query state_transitions table
  RETURN ARRAY(
    SELECT to_status
    FROM public.state_transitions
    WHERE from_status = p_current_status
      AND (is_manual = false OR p_include_manual = true)
    ORDER BY to_status
  );
END;
$$;

COMMENT ON FUNCTION public.get_valid_next_states IS 'Returns array of valid next status codes for a given status';

-- =============================================================================
-- STEP 8: Create view showing items with their valid next states
-- =============================================================================

CREATE OR REPLACE VIEW public.ingestion_queue_with_transitions
WITH (security_invoker = true)
AS
SELECT 
  q.*,
  sl.name as status_name,
  sl.category as status_category,
  sl.is_terminal,
  public.get_valid_next_states(q.status_code, false) as valid_next_states,
  public.get_valid_next_states(q.status_code, true) as valid_next_states_with_manual
FROM public.ingestion_queue q
LEFT JOIN public.status_lookup sl ON sl.code = q.status_code;

COMMENT ON VIEW public.ingestion_queue_with_transitions IS 
  'Queue items with their current status and valid next states';
