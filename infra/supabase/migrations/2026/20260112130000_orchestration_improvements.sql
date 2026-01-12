-- Migration: Orchestration Improvements (US-1 through US-5)
-- Implements retry policy, idempotency, durable timers, and approval tracking

-- =============================================================================
-- US-1: Retry Policy Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.retry_policy (
  step_name text PRIMARY KEY,
  max_attempts integer NOT NULL DEFAULT 3,
  base_delay_seconds integer NOT NULL DEFAULT 60,
  backoff_multiplier numeric NOT NULL DEFAULT 2.0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.retry_policy IS 'Configurable retry policy per enrichment step';

-- Insert default policies for each step
INSERT INTO public.retry_policy (step_name, max_attempts, base_delay_seconds, backoff_multiplier) VALUES
  ('fetch', 3, 30, 2.0),
  ('filter', 3, 60, 2.0),
  ('summarize', 3, 60, 2.0),
  ('tag', 3, 60, 2.0),
  ('thumbnail', 2, 30, 1.5)
ON CONFLICT (step_name) DO NOTHING;

-- =============================================================================
-- US-2 & US-3: Add columns to ingestion_queue for idempotency and retry timers
-- =============================================================================

-- Add idempotency_key for deduplication
ALTER TABLE public.ingestion_queue 
  ADD COLUMN IF NOT EXISTS idempotency_key text;

-- Add retry_after for durable timers
ALTER TABLE public.ingestion_queue 
  ADD COLUMN IF NOT EXISTS retry_after timestamptz;

-- Add step_attempt for tracking current step retry count
ALTER TABLE public.ingestion_queue 
  ADD COLUMN IF NOT EXISTS step_attempt integer DEFAULT 1;

-- Add last_successful_step for partial failure recovery (US-4)
ALTER TABLE public.ingestion_queue 
  ADD COLUMN IF NOT EXISTS last_successful_step text;

-- Index for efficient retry query
CREATE INDEX IF NOT EXISTS idx_ingestion_queue_retry_after 
  ON public.ingestion_queue (retry_after) 
  WHERE retry_after IS NOT NULL;

-- =============================================================================
-- US-2: Add idempotency_key to pipeline_step_run
-- =============================================================================

ALTER TABLE public.pipeline_step_run 
  ADD COLUMN IF NOT EXISTS idempotency_key text;

-- Unique constraint on idempotency_key to prevent duplicate step runs
CREATE UNIQUE INDEX IF NOT EXISTS idx_pipeline_step_run_idempotency 
  ON public.pipeline_step_run (idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

-- =============================================================================
-- US-5: Explicit Human Approval Tracking
-- =============================================================================

-- Add review_notes for capturing approval/rejection reason
ALTER TABLE public.ingestion_queue 
  ADD COLUMN IF NOT EXISTS review_notes text;

-- Add review_action to track what action was taken
ALTER TABLE public.ingestion_queue 
  ADD COLUMN IF NOT EXISTS review_action text;

-- Ensure reviewed_by is properly tracked (already exists but add comment)
COMMENT ON COLUMN public.ingestion_queue.reviewed_by IS 'UUID of the user who reviewed this item';
COMMENT ON COLUMN public.ingestion_queue.reviewed_at IS 'Timestamp when the item was reviewed';
COMMENT ON COLUMN public.ingestion_queue.review_notes IS 'Notes provided during approval/rejection';
COMMENT ON COLUMN public.ingestion_queue.review_action IS 'Action taken: approve, reject, skip, re-enrich';

-- =============================================================================
-- Helper function: Calculate next retry time with exponential backoff
-- =============================================================================

CREATE OR REPLACE FUNCTION public.calculate_retry_after(
  p_step_name text,
  p_current_attempt integer
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_policy retry_policy%ROWTYPE;
  v_delay_seconds integer;
BEGIN
  -- Get retry policy for this step
  SELECT * INTO v_policy FROM retry_policy WHERE step_name = p_step_name;
  
  -- If no policy found, use defaults
  IF NOT FOUND THEN
    v_delay_seconds := 60 * POWER(2.0, p_current_attempt - 1);
  ELSE
    -- Calculate delay with exponential backoff
    v_delay_seconds := v_policy.base_delay_seconds * 
                       POWER(v_policy.backoff_multiplier, p_current_attempt - 1);
  END IF;
  
  RETURN now() + (v_delay_seconds || ' seconds')::interval;
END;
$$;

COMMENT ON FUNCTION public.calculate_retry_after IS 'Calculate next retry time with exponential backoff based on retry_policy';

-- =============================================================================
-- Helper function: Check if step should retry
-- =============================================================================

CREATE OR REPLACE FUNCTION public.should_retry_step(
  p_step_name text,
  p_current_attempt integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_attempts integer;
BEGIN
  SELECT max_attempts INTO v_max_attempts 
  FROM retry_policy 
  WHERE step_name = p_step_name;
  
  -- Default to 3 if no policy found
  IF NOT FOUND THEN
    v_max_attempts := 3;
  END IF;
  
  RETURN p_current_attempt < v_max_attempts;
END;
$$;

COMMENT ON FUNCTION public.should_retry_step IS 'Check if a step should be retried based on retry_policy';

-- =============================================================================
-- View: Items ready for retry
-- =============================================================================

CREATE OR REPLACE VIEW public.retry_queue_ready AS
SELECT 
  iq.*,
  sl.name as status_name
FROM public.ingestion_queue iq
JOIN public.status_lookup sl ON sl.code = iq.status_code
WHERE 
  iq.retry_after IS NOT NULL 
  AND iq.retry_after <= now()
  AND iq.status_code NOT IN (
    SELECT code FROM status_lookup WHERE category = 'terminal'
  )
ORDER BY iq.retry_after ASC;

COMMENT ON VIEW public.retry_queue_ready IS 'Items that are ready for automatic retry';

-- =============================================================================
-- View: Workflow status summary (for US-6 dashboard)
-- =============================================================================

CREATE OR REPLACE VIEW public.workflow_status_summary AS
SELECT 
  sl.code as status_code,
  sl.name as status_name,
  sl.category,
  COUNT(iq.id) as item_count,
  COUNT(CASE WHEN iq.failure_count > 0 THEN 1 END) as failed_count,
  COUNT(CASE WHEN iq.retry_after IS NOT NULL AND iq.retry_after > now() THEN 1 END) as pending_retry_count,
  AVG(EXTRACT(EPOCH FROM (now() - iq.discovered_at)) / 3600)::numeric(10,2) as avg_age_hours
FROM public.status_lookup sl
LEFT JOIN public.ingestion_queue iq ON iq.status_code = sl.code
GROUP BY sl.code, sl.name, sl.category
ORDER BY sl.code;

COMMENT ON VIEW public.workflow_status_summary IS 'Summary of items per workflow status for dashboard';

-- =============================================================================
-- View: Step failure rates (for US-6 dashboard)
-- =============================================================================

CREATE OR REPLACE VIEW public.step_failure_rates AS
SELECT 
  psr.step_name,
  COUNT(*) as total_runs,
  COUNT(CASE WHEN psr.status = 'completed' THEN 1 END) as succeeded,
  COUNT(CASE WHEN psr.status = 'failed' THEN 1 END) as failed,
  ROUND(
    COUNT(CASE WHEN psr.status = 'failed' THEN 1 END)::numeric / 
    NULLIF(COUNT(*), 0) * 100, 
    2
  ) as failure_rate_pct,
  AVG(
    EXTRACT(EPOCH FROM (psr.completed_at - psr.started_at))
  )::numeric(10,2) as avg_duration_seconds
FROM public.pipeline_step_run psr
WHERE psr.started_at > now() - interval '24 hours'
GROUP BY psr.step_name
ORDER BY psr.step_name;

COMMENT ON VIEW public.step_failure_rates IS 'Step failure rates over last 24 hours for dashboard';

-- =============================================================================
-- View: Stuck items (for US-6 dashboard)
-- =============================================================================

CREATE OR REPLACE VIEW public.stuck_items AS
SELECT 
  iq.id,
  iq.url,
  iq.status_code,
  sl.name as status_name,
  iq.last_failed_step,
  iq.last_error_message,
  iq.failure_count,
  iq.discovered_at,
  EXTRACT(EPOCH FROM (now() - COALESCE(iq.last_error_at, iq.discovered_at))) / 3600 as stuck_hours
FROM public.ingestion_queue iq
JOIN public.status_lookup sl ON sl.code = iq.status_code
WHERE 
  sl.category NOT IN ('terminal', 'published')
  AND (
    -- Stuck for more than 1 hour without progress
    (iq.last_error_at IS NOT NULL AND iq.last_error_at < now() - interval '1 hour')
    OR
    -- In processing state for more than 2 hours
    (sl.category = 'processing' AND iq.discovered_at < now() - interval '2 hours')
  )
ORDER BY stuck_hours DESC;

COMMENT ON VIEW public.stuck_items IS 'Items stuck in non-terminal states for dashboard';
