-- Migration: Add cost tracking columns to pipeline_run
-- US-7.1: Persist LLM cost per pipeline run
-- ASMM Dimension 7: Spend + Capacity Controls → Phase 1

-- =============================================================================
-- STEP 1: Add cost tracking columns to pipeline_run
-- =============================================================================

ALTER TABLE public.pipeline_run
  ADD COLUMN IF NOT EXISTS llm_tokens_input INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS llm_tokens_output INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS embedding_tokens INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_cost_usd NUMERIC(10, 6);

COMMENT ON COLUMN public.pipeline_run.llm_tokens_input IS 'Total input tokens used across all LLM calls in this run';
COMMENT ON COLUMN public.pipeline_run.llm_tokens_output IS 'Total output tokens generated across all LLM calls in this run';
COMMENT ON COLUMN public.pipeline_run.embedding_tokens IS 'Total tokens used for embedding calls in this run';
COMMENT ON COLUMN public.pipeline_run.estimated_cost_usd IS 'Estimated cost in USD based on token usage and model pricing';

-- =============================================================================
-- STEP 2: Create index for cost queries
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_pipeline_run_estimated_cost 
  ON public.pipeline_run(estimated_cost_usd) 
  WHERE estimated_cost_usd IS NOT NULL;

-- =============================================================================
-- STEP 3: Create function to update run costs
-- =============================================================================

CREATE OR REPLACE FUNCTION public.add_run_token_usage(
  p_run_id UUID,
  p_llm_input INT DEFAULT 0,
  p_llm_output INT DEFAULT 0,
  p_embedding INT DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.pipeline_run
  SET 
    llm_tokens_input = COALESCE(llm_tokens_input, 0) + p_llm_input,
    llm_tokens_output = COALESCE(llm_tokens_output, 0) + p_llm_output,
    embedding_tokens = COALESCE(embedding_tokens, 0) + p_embedding
  WHERE id = p_run_id;
END;
$$;

COMMENT ON FUNCTION public.add_run_token_usage IS 'Atomically add token usage to a pipeline run';

-- =============================================================================
-- STEP 4: Create function to calculate and set estimated cost
-- =============================================================================

CREATE OR REPLACE FUNCTION public.calculate_run_cost(p_run_id UUID)
RETURNS NUMERIC(10, 6)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_llm_input INT;
  v_llm_output INT;
  v_embedding INT;
  v_cost NUMERIC(10, 6);
BEGIN
  -- Get current token counts
  SELECT llm_tokens_input, llm_tokens_output, embedding_tokens
  INTO v_llm_input, v_llm_output, v_embedding
  FROM public.pipeline_run
  WHERE id = p_run_id;

  -- Calculate cost using approximate pricing (USD per 1M tokens)
  -- GPT-4o-mini: $0.15/1M input, $0.60/1M output
  -- text-embedding-3-small: $0.02/1M tokens
  v_cost := (
    (COALESCE(v_llm_input, 0) / 1000000.0) * 0.15 +
    (COALESCE(v_llm_output, 0) / 1000000.0) * 0.60 +
    (COALESCE(v_embedding, 0) / 1000000.0) * 0.02
  );

  -- Update the run with calculated cost
  UPDATE public.pipeline_run
  SET estimated_cost_usd = v_cost
  WHERE id = p_run_id;

  RETURN v_cost;
END;
$$;

COMMENT ON FUNCTION public.calculate_run_cost IS 'Calculate and store estimated USD cost for a pipeline run based on token usage';

-- =============================================================================
-- STEP 5: Create view for cost reporting
-- =============================================================================

CREATE OR REPLACE VIEW public.pipeline_run_costs
WITH (security_invoker = true)
AS
SELECT 
  pr.id,
  pr.queue_id,
  pr.trigger,
  pr.status,
  pr.started_at,
  pr.completed_at,
  pr.llm_tokens_input,
  pr.llm_tokens_output,
  pr.embedding_tokens,
  pr.estimated_cost_usd,
  EXTRACT(EPOCH FROM (pr.completed_at - pr.started_at)) as duration_seconds
FROM public.pipeline_run pr
WHERE pr.estimated_cost_usd IS NOT NULL;

COMMENT ON VIEW public.pipeline_run_costs IS 'View for querying pipeline run costs and token usage';
