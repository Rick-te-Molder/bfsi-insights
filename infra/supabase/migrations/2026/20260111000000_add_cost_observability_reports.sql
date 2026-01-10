-- Migration: Add cost observability reporting RPCs
-- US-7.2: Basic Cost Observability
-- ASMM Dimension 7: Spend + Capacity Controls → Phase 1

-- =============================================================================
-- STEP 1: Cost per day (pipeline_run)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_pipeline_cost_per_day(p_days int DEFAULT 7)
RETURNS TABLE(
  day date,
  run_count int,
  total_cost_usd numeric(10, 6)
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    date_trunc('day', pr.completed_at)::date AS day,
    count(*)::int AS run_count,
    sum(pr.estimated_cost_usd)::numeric(10, 6) AS total_cost_usd
  FROM public.pipeline_run pr
  WHERE pr.estimated_cost_usd IS NOT NULL
    AND pr.completed_at >= (now() - (p_days::text || ' days')::interval)
  GROUP BY 1
  ORDER BY 1 DESC;
$$;

COMMENT ON FUNCTION public.get_pipeline_cost_per_day IS 'Aggregate estimated pipeline_run cost per day (last N days)';

-- =============================================================================
-- STEP 2: Cost per agent (agent_run_metric)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_agent_cost_breakdown(p_days int DEFAULT 7)
RETURNS TABLE(
  agent_name text,
  run_count int,
  input_tokens bigint,
  output_tokens bigint,
  total_cost_usd numeric(10, 6)
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    ar.agent_name,
    count(distinct ar.id)::int AS run_count,
    sum(CASE WHEN arm.metric_name = 'tokens_prompt' THEN arm.metric_value ELSE 0 END)::bigint AS input_tokens,
    sum(CASE WHEN arm.metric_name = 'tokens_completion' THEN arm.metric_value ELSE 0 END)::bigint AS output_tokens,
    (
      (sum(CASE WHEN arm.metric_name = 'tokens_prompt' THEN arm.metric_value ELSE 0 END) / 1000000.0) * 0.15 +
      (sum(CASE WHEN arm.metric_name = 'tokens_completion' THEN arm.metric_value ELSE 0 END) / 1000000.0) * 0.60
    )::numeric(10, 6) AS total_cost_usd
  FROM public.agent_run_metric arm
  JOIN public.agent_run ar ON ar.id = arm.run_id
  WHERE arm.metric_name IN ('tokens_prompt', 'tokens_completion')
    AND ar.started_at >= (now() - (p_days::text || ' days')::interval)
  GROUP BY ar.agent_name
  ORDER BY total_cost_usd DESC;
$$;

COMMENT ON FUNCTION public.get_agent_cost_breakdown IS 'Aggregate estimated cost per agent (derived from agent_run_metric tokens_total metadata, last N days)';

-- =============================================================================
-- STEP 3: Cost per model (agent_run_metric)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_model_cost_breakdown(p_days int DEFAULT 7)
RETURNS TABLE(
  model_id text,
  run_count int,
  input_tokens bigint,
  output_tokens bigint,
  total_cost_usd numeric(10, 6)
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    COALESCE(ar.model_id, 'unknown') AS model_id,
    count(distinct ar.id)::int AS run_count,
    sum(CASE WHEN arm.metric_name = 'tokens_prompt' THEN arm.metric_value ELSE 0 END)::bigint AS input_tokens,
    sum(CASE WHEN arm.metric_name = 'tokens_completion' THEN arm.metric_value ELSE 0 END)::bigint AS output_tokens,
    (
      (sum(CASE WHEN arm.metric_name = 'tokens_prompt' THEN arm.metric_value ELSE 0 END) / 1000000.0) * 0.15 +
      (sum(CASE WHEN arm.metric_name = 'tokens_completion' THEN arm.metric_value ELSE 0 END) / 1000000.0) * 0.60
    )::numeric(10, 6) AS total_cost_usd
  FROM public.agent_run_metric arm
  JOIN public.agent_run ar ON ar.id = arm.run_id
  WHERE arm.metric_name IN ('tokens_prompt', 'tokens_completion')
    AND ar.started_at >= (now() - (p_days::text || ' days')::interval)
  GROUP BY 1
  ORDER BY total_cost_usd DESC;
$$;

COMMENT ON FUNCTION public.get_model_cost_breakdown IS 'Aggregate estimated cost per model (derived from agent_run_metric tokens_total metadata, last N days)';
