-- Fix Security and Performance Issues from Supabase Linter
-- Run date: 2025-11-30

-- ============================================================================
-- 1. FIX: Remove SECURITY DEFINER from kb_publication_pretty view (ERROR)
-- ============================================================================

-- Recreate view without SECURITY DEFINER (uses SECURITY INVOKER by default)
DROP VIEW IF EXISTS public.kb_publication_pretty CASCADE;

CREATE OR REPLACE VIEW kb_publication_pretty AS
SELECT 
  p.id, p.slug, p.title,
  p.author as authors,
  p.date_published, p.date_added, p.last_edited,
  p.source_url as url, p.source_name, p.source_domain,
  p.thumbnail, p.thumbnail_bucket, p.thumbnail_path,
  p.summary_short, p.summary_medium, p.summary_long,
  p.role, p.content_type, p.geography, p.use_cases, p.agentic_capabilities, p.status,
  COALESCE(ARRAY_AGG(DISTINCT pbi.industry_code) FILTER (WHERE pbi.industry_code IS NOT NULL), ARRAY[]::text[]) as industries,
  COALESCE(ARRAY_AGG(DISTINCT pbt.topic_code) FILTER (WHERE pbt.topic_code IS NOT NULL), ARRAY[]::text[]) as topics,
  (ARRAY_AGG(DISTINCT pbi.industry_code) FILTER (WHERE pbi.industry_code IS NOT NULL))[1] as industry,
  (ARRAY_AGG(DISTINCT pbt.topic_code) FILTER (WHERE pbt.topic_code IS NOT NULL))[1] as topic
FROM kb_publication p
LEFT JOIN kb_publication_bfsi_industry pbi ON p.id = pbi.publication_id
LEFT JOIN kb_publication_bfsi_topic pbt ON p.id = pbt.publication_id
GROUP BY p.id;

-- Grant access (RLS will apply based on kb_publication policies)
GRANT SELECT ON public.kb_publication_pretty TO anon, authenticated;

-- ============================================================================
-- 2. FIX: Set search_path on functions (WARN)
-- ============================================================================

-- Fix approve_from_queue
ALTER FUNCTION public.approve_from_queue(uuid) SET search_path = public;

-- Fix trigger_site_rebuild (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trigger_site_rebuild') THEN
    EXECUTE 'ALTER FUNCTION public.trigger_site_rebuild() SET search_path = public';
  END IF;
END $$;

-- Fix trigger_auto_process_url (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trigger_auto_process_url') THEN
    EXECUTE 'ALTER FUNCTION public.trigger_auto_process_url() SET search_path = public';
  END IF;
END $$;

-- ============================================================================
-- 3. FIX: Consolidate multiple permissive policies on ingestion_queue (WARN)
-- ============================================================================

-- Drop the redundant policies and create a single consolidated one
DROP POLICY IF EXISTS "Users can view queue items for review" ON public.ingestion_queue;
DROP POLICY IF EXISTS "ingestion_queue_authenticated_all" ON public.ingestion_queue;

-- Create single consolidated SELECT policy
CREATE POLICY "authenticated_can_view_queue"
ON public.ingestion_queue
FOR SELECT
TO authenticated
USING (true);

-- ============================================================================
-- 4. FIX: Add primary key to stg.taxonomy_bian_stg (INFO)
-- ============================================================================

DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'stg' AND table_name = 'taxonomy_bian_stg') THEN
    -- Add id column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'stg' AND table_name = 'taxonomy_bian_stg' AND column_name = 'id') THEN
      EXECUTE 'ALTER TABLE stg.taxonomy_bian_stg ADD COLUMN id SERIAL PRIMARY KEY';
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 5. FIX: Drop unused indexes (INFO - improves write performance)
-- ============================================================================

-- Agent run indexes
DROP INDEX IF EXISTS public.idx_agent_run_queue_id;
DROP INDEX IF EXISTS public.idx_agent_run_stg_id;
DROP INDEX IF EXISTS public.idx_agent_run_step_run_id;

-- Ingestion queue indexes (keep important ones, drop unused)
DROP INDEX IF EXISTS public.idx_ingestion_queue_approved_at;
DROP INDEX IF EXISTS public.idx_ingestion_queue_reviewer;

-- Rejection analytics indexes
DROP INDEX IF EXISTS public.idx_rejection_analytics_prompt_version;
DROP INDEX IF EXISTS public.idx_rejection_analytics_created_at;
DROP INDEX IF EXISTS public.idx_rejection_analytics_category;

-- Other unused indexes
DROP INDEX IF EXISTS public.idx_ag_use_case_capability_capability;
DROP INDEX IF EXISTS public.idx_standard_regulator;
DROP INDEX IF EXISTS public.idx_standard_standard_setter;
DROP INDEX IF EXISTS public.kb_publication_standard_publication_id_idx;
DROP INDEX IF EXISTS public.idx_kb_res_standard_resource;
DROP INDEX IF EXISTS public.idx_kb_res_standard_dim;
DROP INDEX IF EXISTS public.idx_ref_source_tier;
DROP INDEX IF EXISTS public.idx_ref_source_category;
DROP INDEX IF EXISTS public.idx_ref_source_enabled;
DROP INDEX IF EXISTS public.idx_kb_publication_ag_vendor_vendor_id;
DROP INDEX IF EXISTS public.idx_kb_publication_bfsi_org_org_id;
DROP INDEX IF EXISTS public.idx_kb_publication_status;
DROP INDEX IF EXISTS public.idx_kb_publication_source_url;
DROP INDEX IF EXISTS public.idx_process_parent;
DROP INDEX IF EXISTS public.idx_process_level;
DROP INDEX IF EXISTS public.idx_topic_parent;
DROP INDEX IF EXISTS public.idx_topic_level;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON VIEW public.kb_publication_pretty IS 
  'Flattened view of publications with taxonomy arrays. Uses SECURITY INVOKER (default) for proper RLS.';

-- ============================================================================
-- NOTE: pg_net extension in public schema
-- Moving extensions requires superuser access. This should be done via 
-- Supabase dashboard or by Supabase support if needed.
-- For now, this is acceptable as pg_net is a trusted extension.
-- ============================================================================
