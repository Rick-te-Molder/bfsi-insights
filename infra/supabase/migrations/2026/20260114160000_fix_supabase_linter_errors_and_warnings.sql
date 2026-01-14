-- Fix Supabase linter findings (errors + warnings), excluding leaked password protection.
-- - Enable RLS on public tables exposed to PostgREST
-- - Replace permissive RLS policies (always true) with role-gated predicates
-- - Ensure views are SECURITY INVOKER
-- - Ensure trigger functions have immutable search_path

-- =============================================================================
-- Function: fix mutable search_path warning
-- =============================================================================
CREATE OR REPLACE FUNCTION public.set_utility_version_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =============================================================================
-- Helper predicates (avoid repeating literals across many policies)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT auth.role() = 'service_role';
$$;

CREATE OR REPLACE FUNCTION public.is_authenticated()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.ensure_service_role_all_policy(
  p_table regclass,
  p_policy_name text
)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Build once to avoid repeating literals in dynamic SQL.
  -- Both USING and WITH CHECK must use the same predicate.
  DECLARE
    v_predicate text := 'public.is_service_role()';
  BEGIN
  EXECUTE format('DROP POLICY IF EXISTS %I ON %s', p_policy_name, p_table);
  EXECUTE format(
    'CREATE POLICY %I ON %s FOR ALL TO service_role USING (%s) WITH CHECK (%s)',
    p_policy_name,
    p_table,
    v_predicate,
    v_predicate
  );
  END;
END;
$$;

-- =============================================================================
-- RLS: utility_version
-- =============================================================================
ALTER TABLE IF EXISTS public.utility_version ENABLE ROW LEVEL SECURITY;

SELECT public.ensure_service_role_all_policy('public.utility_version'::regclass, 'service utility_version all');

-- =============================================================================
-- RLS: retry_policy
-- =============================================================================
ALTER TABLE IF EXISTS public.retry_policy ENABLE ROW LEVEL SECURITY;

SELECT public.ensure_service_role_all_policy('public.retry_policy'::regclass, 'service retry_policy all');

-- =============================================================================
-- RLS: topic junction table (table name differs across environments)
-- =============================================================================
DO $$
DECLARE
  v_schema text := 'public';
  v_table_legacy text := 'kb_publication_bfsi_topic';
  v_table_new text := 'kb_publication_kb_topic';
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = v_schema AND table_name = v_table_legacy
  ) THEN
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', v_schema, v_table_legacy);

    -- Public read access (deliberate)
    EXECUTE format('DROP POLICY IF EXISTS "Public read junction topics" ON %I.%I', v_schema, v_table_legacy);
    EXECUTE format('CREATE POLICY "Public read junction topics" ON %I.%I FOR SELECT TO public USING (true)', v_schema, v_table_legacy);

    -- Service role full access
    PERFORM public.ensure_service_role_all_policy(format('%I.%I', v_schema, v_table_legacy)::regclass, 'Service junction topics');
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = v_schema AND table_name = v_table_new
  ) THEN
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', v_schema, v_table_new);

    -- Public read access (deliberate)
    EXECUTE format('DROP POLICY IF EXISTS "Public read junction topics" ON %I.%I', v_schema, v_table_new);
    EXECUTE format('CREATE POLICY "Public read junction topics" ON %I.%I FOR SELECT TO public USING (true)', v_schema, v_table_new);

    -- Service role full access
    PERFORM public.ensure_service_role_all_policy(format('%I.%I', v_schema, v_table_new)::regclass, 'Service junction topics');
  END IF;
END $$;

-- =============================================================================
-- Views: enforce SECURITY INVOKER (not SECURITY DEFINER)
-- =============================================================================
DROP VIEW IF EXISTS public.retry_queue_ready;
CREATE VIEW public.retry_queue_ready
WITH (security_invoker = true) AS
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

DROP VIEW IF EXISTS public.workflow_status_summary;
CREATE VIEW public.workflow_status_summary
WITH (security_invoker = true) AS
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

DROP VIEW IF EXISTS public.step_failure_rates;
CREATE VIEW public.step_failure_rates
WITH (security_invoker = true) AS
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

DROP VIEW IF EXISTS public.stuck_items;
CREATE VIEW public.stuck_items
WITH (security_invoker = true) AS
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
    (iq.last_error_at IS NOT NULL AND iq.last_error_at < now() - interval '1 hour')
    OR
    (sl.category = 'processing' AND iq.discovered_at < now() - interval '2 hours')
  )
ORDER BY stuck_hours DESC;

COMMENT ON VIEW public.stuck_items IS 'Items stuck in non-terminal states for dashboard';

-- =============================================================================
-- Permissive RLS policies: replace always-true expressions with role-gated checks
-- =============================================================================

-- agent_jobs
SELECT public.ensure_service_role_all_policy('public.agent_jobs'::regclass, 'Service role can manage agent_jobs');

-- pipeline_run
SELECT public.ensure_service_role_all_policy('public.pipeline_run'::regclass, 'Service role can manage pipeline_run');

-- pipeline_step_run
SELECT public.ensure_service_role_all_policy('public.pipeline_step_run'::regclass, 'Service role can manage pipeline_step_run');

-- system_config
SELECT public.ensure_service_role_all_policy('public.system_config'::regclass, 'Service role can manage system_config');

-- proposed_entity (authenticated update)
DROP POLICY IF EXISTS "Authenticated users can update proposed_entity" ON public.proposed_entity;
CREATE POLICY "Authenticated users can update proposed_entity" ON public.proposed_entity
  FOR UPDATE
  TO authenticated
  USING (public.is_authenticated())
  WITH CHECK (public.is_authenticated());

-- missed_discovery
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.missed_discovery;
CREATE POLICY "Allow authenticated insert" ON public.missed_discovery
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_authenticated());

DROP POLICY IF EXISTS "Allow authenticated update" ON public.missed_discovery;
CREATE POLICY "Allow authenticated update" ON public.missed_discovery
  FOR UPDATE
  TO authenticated
  USING (public.is_authenticated())
  WITH CHECK (public.is_authenticated());

-- ingestion_queue (policy name may differ across environments; make best-effort)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN (
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ingestion_queue'
      AND cmd = 'INSERT'
      AND 'authenticated' = ANY (roles)
  ) LOOP
    EXECUTE format('DROP POLICY %I ON public.ingestion_queue', r.policyname);
    EXECUTE format(
      'CREATE POLICY %I ON public.ingestion_queue FOR INSERT TO authenticated WITH CHECK (public.is_authenticated())',
      r.policyname
    );
  END LOOP;
END $$;
