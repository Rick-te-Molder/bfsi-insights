-- Fix Database Linter Issues
-- https://supabase.com/docs/guides/database/database-linter

-- =============================================================================
-- 1. SECURITY: Remove SECURITY DEFINER from view (ERROR level)
-- =============================================================================
-- The view should use invoker's permissions, not definer's
DROP VIEW IF EXISTS public.kb_publication_pretty;

CREATE VIEW public.kb_publication_pretty AS
SELECT 
  p.id,
  p.slug,
  p.title,
  p.author AS authors,
  p.date_published,
  p.date_added,
  p.last_edited,
  p.source_url AS url,
  p.source_name,
  p.source_domain,
  p.thumbnail,
  p.thumbnail_bucket,
  p.thumbnail_path,
  p.summary_short,
  p.summary_medium,
  p.summary_long,
  p.role,
  p.content_type,
  p.geography,
  p.use_cases,
  p.agentic_capabilities,
  p.status,
  COALESCE(
    (SELECT array_agg(i.industry_code) FROM kb_publication_bfsi_industry i WHERE i.publication_id = p.id),
    ARRAY[]::text[]
  ) AS industries,
  COALESCE(
    (SELECT array_agg(t.topic_code) FROM kb_publication_bfsi_topic t WHERE t.publication_id = p.id),
    ARRAY[]::text[]
  ) AS topics,
  (SELECT i.industry_code FROM kb_publication_bfsi_industry i WHERE i.publication_id = p.id LIMIT 1) AS industry,
  (SELECT t.topic_code FROM kb_publication_bfsi_topic t WHERE t.publication_id = p.id LIMIT 1) AS topic
FROM kb_publication p;

-- Grant permissions
GRANT SELECT ON public.kb_publication_pretty TO anon, authenticated;

-- =============================================================================
-- 2. SECURITY: Set search_path on functions (WARN level)
-- =============================================================================

-- Fix trigger_site_rebuild
ALTER FUNCTION public.trigger_site_rebuild() SET search_path = public;

-- Fix trigger_auto_process_url  
ALTER FUNCTION public.trigger_auto_process_url() SET search_path = public;

-- =============================================================================
-- 3. PERFORMANCE: Add missing foreign key indexes (INFO level)
-- =============================================================================

-- ag_use_case_capability
CREATE INDEX IF NOT EXISTS idx_ag_use_case_capability_capability_id 
ON public.ag_use_case_capability(capability_id);

-- agent_run
CREATE INDEX IF NOT EXISTS idx_agent_run_queue_id ON public.agent_run(queue_id);
CREATE INDEX IF NOT EXISTS idx_agent_run_stg_id ON public.agent_run(stg_id);

-- agent_run_step
CREATE INDEX IF NOT EXISTS idx_agent_run_step_run_id ON public.agent_run_step(run_id);

-- bfsi_process (parent_code FK)
CREATE INDEX IF NOT EXISTS idx_bfsi_process_parent_code ON public.bfsi_process(parent_code);

-- bfsi_topic (parent_code FK)
CREATE INDEX IF NOT EXISTS idx_bfsi_topic_parent_code ON public.bfsi_topic(parent_code);

-- eval_run
CREATE INDEX IF NOT EXISTS idx_eval_run_golden_set_id ON public.eval_run(golden_set_id);

-- kb_publication_ag_vendor
CREATE INDEX IF NOT EXISTS idx_kb_publication_ag_vendor_vendor_id 
ON public.kb_publication_ag_vendor(vendor_id);

-- kb_publication_bfsi_organization
CREATE INDEX IF NOT EXISTS idx_kb_publication_bfsi_organization_org_id 
ON public.kb_publication_bfsi_organization(organization_id);

-- kb_publication_standard
CREATE INDEX IF NOT EXISTS idx_kb_publication_standard_standard_id 
ON public.kb_publication_standard(standard_id);

-- rejection_analytics
CREATE INDEX IF NOT EXISTS idx_rejection_analytics_prompt_version 
ON public.rejection_analytics(prompt_version);

-- standard
CREATE INDEX IF NOT EXISTS idx_standard_regulator_id ON public.standard(regulator_id);
CREATE INDEX IF NOT EXISTS idx_standard_standard_setter_id ON public.standard(standard_setter_id);

-- =============================================================================
-- 4. PERFORMANCE: Add primary key to staging table (INFO level)
-- =============================================================================
-- Note: Only add if the table exists and doesn't have a PK
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'stg' AND table_name = 'taxonomy_bian_stg') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_schema = 'stg' AND table_name = 'taxonomy_bian_stg' AND constraint_type = 'PRIMARY KEY'
    ) THEN
      -- Add a row_id column as primary key if no natural key exists
      ALTER TABLE stg.taxonomy_bian_stg ADD COLUMN IF NOT EXISTS row_id SERIAL PRIMARY KEY;
    END IF;
  END IF;
END $$;

-- =============================================================================
-- 5. PERFORMANCE: Drop unused indexes (INFO level)
-- =============================================================================
-- These indexes have never been used, removing to save storage and write overhead
DROP INDEX IF EXISTS public.idx_eval_golden_agent;
DROP INDEX IF EXISTS public.idx_eval_run_agent;
DROP INDEX IF EXISTS public.idx_eval_result_run;

-- =============================================================================
-- NOTES: Manual fixes required in Supabase Dashboard
-- =============================================================================
-- 
-- 1. extension_in_public (pg_net):
--    Cannot be moved via migration. Contact Supabase support or 
--    recreate the extension in a different schema via dashboard.
--
-- 2. auth_leaked_password_protection:
--    Enable in Supabase Dashboard:
--    Authentication > Settings > Password Protection > Enable "Leaked password protection"
--
