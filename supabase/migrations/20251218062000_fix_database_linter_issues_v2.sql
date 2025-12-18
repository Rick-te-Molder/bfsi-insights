-- Fix Database Linter Issues (v2)
-- https://supabase.com/docs/guides/database/database-linter

-- =============================================================================
-- 1. SECURITY ERROR: Remove SECURITY DEFINER from review_queue_ready view
-- =============================================================================
-- Recreate view without SECURITY DEFINER, preserving exact structure
DROP VIEW IF EXISTS public.review_queue_ready;

CREATE VIEW public.review_queue_ready AS
SELECT 
  id,
  url,
  url_norm,
  content_hash,
  content_type,
  payload,
  payload_schema_version,
  raw_ref,
  thumb_ref,
  etag,
  last_modified,
  discovered_at,
  fetched_at,
  reviewed_at,
  reviewer,
  rejection_reason,
  prompt_version,
  model_id,
  agent_metadata,
  stg_id,
  approved_at,
  relevance_score,
  executive_summary,
  skip_reason,
  status_code,
  entry_type,
  reviewed_by,
  current_run_id
FROM ingestion_queue iq
WHERE status_code = 300 
  AND (current_run_id IS NULL OR (
    EXISTS (
      SELECT 1
      FROM pipeline_step_run psr
      WHERE psr.run_id = iq.current_run_id 
        AND psr.step_name = ANY (ARRAY['summarize'::text, 'tag'::text, 'thumbnail'::text])
      GROUP BY psr.run_id
      HAVING count(DISTINCT psr.step_name) = 3 
        AND bool_and(psr.status = 'success'::text)
    )
  ));

GRANT SELECT ON public.review_queue_ready TO anon, authenticated;

-- =============================================================================
-- 2. SECURITY WARN: Set search_path on functions with mutable search_path
-- =============================================================================

-- Fix update_created_at_on_version_change
ALTER FUNCTION public.update_created_at_on_version_change() SET search_path = public;

-- Fix get_step_stats_24h
ALTER FUNCTION public.get_step_stats_24h() SET search_path = public;

-- Fix approve_from_queue
ALTER FUNCTION public.approve_from_queue(uuid) SET search_path = public;

-- =============================================================================
-- 3. PERFORMANCE INFO: Add indexes for unindexed foreign keys
-- =============================================================================

-- audit_log.user_id
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON public.audit_log(user_id);

-- classic_papers.publication_id
CREATE INDEX IF NOT EXISTS idx_classic_papers_publication_id ON public.classic_papers(publication_id);

-- discovery_metrics.source_slug
CREATE INDEX IF NOT EXISTS idx_discovery_metrics_source_slug ON public.discovery_metrics(source_slug);

-- ingestion_queue.reviewed_by
CREATE INDEX IF NOT EXISTS idx_ingestion_queue_reviewed_by ON public.ingestion_queue(reviewed_by);

-- kb_source.primary_audience
CREATE INDEX IF NOT EXISTS idx_kb_source_primary_audience ON public.kb_source(primary_audience);

-- missed_discovery.contributed_to_source
CREATE INDEX IF NOT EXISTS idx_missed_discovery_contributed_to_source ON public.missed_discovery(contributed_to_source);

-- prompt_ab_test_item.queue_item_id
CREATE INDEX IF NOT EXISTS idx_prompt_ab_test_item_queue_item_id ON public.prompt_ab_test_item(queue_item_id);

-- prompt_ab_test_item.test_id
CREATE INDEX IF NOT EXISTS idx_prompt_ab_test_item_test_id ON public.prompt_ab_test_item(test_id);

-- prompt_version.created_by
CREATE INDEX IF NOT EXISTS idx_prompt_version_created_by ON public.prompt_version(created_by);

-- prompt_version.last_eval_run_id
CREATE INDEX IF NOT EXISTS idx_prompt_version_last_eval_run_id ON public.prompt_version(last_eval_run_id);

-- proposed_entity.source_queue_id
CREATE INDEX IF NOT EXISTS idx_proposed_entity_source_queue_id ON public.proposed_entity(source_queue_id);

-- rejection_analytics.prompt_version_id
CREATE INDEX IF NOT EXISTS idx_rejection_analytics_prompt_version_id ON public.rejection_analytics(prompt_version_id);

-- status_history.queue_id
CREATE INDEX IF NOT EXISTS idx_status_history_queue_id ON public.status_history(queue_id);

-- thumbnail_item_status.job_id
CREATE INDEX IF NOT EXISTS idx_thumbnail_item_status_job_id ON public.thumbnail_item_status(job_id);

-- thumbnail_item_status.publication_id
CREATE INDEX IF NOT EXISTS idx_thumbnail_item_status_publication_id ON public.thumbnail_item_status(publication_id);

-- thumbnail_item_status.queue_item_id
CREATE INDEX IF NOT EXISTS idx_thumbnail_item_status_queue_item_id ON public.thumbnail_item_status(queue_item_id);

-- =============================================================================
-- 4. PERFORMANCE INFO: Drop unused indexes
-- =============================================================================
-- These indexes have never been used according to pg_stat_user_indexes

DROP INDEX IF EXISTS public.idx_pub_obligation_code;
DROP INDEX IF EXISTS public.idx_kb_pub_regulator_code;
DROP INDEX IF EXISTS public.idx_kb_pub_regulation_code;
DROP INDEX IF EXISTS public.idx_eval_run_prompt_version;
DROP INDEX IF EXISTS public.idx_thumbnail_jobs_current_item;
DROP INDEX IF EXISTS public.idx_kb_geography_parent;
DROP INDEX IF EXISTS public.idx_ag_use_case_capability_capability_id;
DROP INDEX IF EXISTS public.idx_bfsi_process_parent_code;
DROP INDEX IF EXISTS public.idx_bfsi_topic_parent_code;
DROP INDEX IF EXISTS public.idx_eval_run_golden_set_id;
DROP INDEX IF EXISTS public.idx_kb_publication_ag_vendor_vendor_id;
DROP INDEX IF EXISTS public.idx_kb_publication_bfsi_organization_org_id;
DROP INDEX IF EXISTS public.idx_kb_publication_standard_standard_id;
DROP INDEX IF EXISTS public.idx_standard_regulator_id;
DROP INDEX IF EXISTS public.idx_standard_standard_setter_id;
DROP INDEX IF EXISTS public.idx_pipeline_run_status;
DROP INDEX IF EXISTS public.idx_pipeline_run_started_at;
DROP INDEX IF EXISTS public.idx_pipeline_step_run_run_id;
DROP INDEX IF EXISTS public.idx_pipeline_step_run_step_name;
DROP INDEX IF EXISTS public.idx_eval_result_run_id;
DROP INDEX IF EXISTS public.idx_missed_discovery_queue_id;
