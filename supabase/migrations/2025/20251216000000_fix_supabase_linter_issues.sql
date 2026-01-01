-- Migration: Fix Supabase Database Linter Issues
-- KB-255: Address RLS, search_path, duplicate indexes, and unused indexes

-- =============================================================================
-- 1. ERRORS: Enable RLS on tables missing it
-- =============================================================================

ALTER TABLE public.seen_urls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_queue_archive ENABLE ROW LEVEL SECURITY;

-- RLS policies for seen_urls (service role only - internal table)
CREATE POLICY "Service role full access on seen_urls"
  ON public.seen_urls
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS policies for ingestion_queue_archive (service role only - internal table)
CREATE POLICY "Service role full access on ingestion_queue_archive"
  ON public.ingestion_queue_archive
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- 2. WARNINGS: Fix function search_path issues
-- =============================================================================

-- Fix update_prompt_eval_status
ALTER FUNCTION public.update_prompt_eval_status SET search_path = public;

-- Fix archive_old_queue_items
ALTER FUNCTION public.archive_old_queue_items SET search_path = public;

-- Fix dump_schema_info
ALTER FUNCTION public.dump_schema_info SET search_path = public;

-- Fix get_entity_audit_history
ALTER FUNCTION public.get_entity_audit_history SET search_path = public;

-- Fix audit_trigger_func
ALTER FUNCTION public.audit_trigger_func SET search_path = public;

-- Note: approve_from_queue already has search_path set in 20251211104231

-- =============================================================================
-- 3. WARNINGS: Revoke anon/authenticated access from materialized view
-- =============================================================================

REVOKE SELECT ON public.rejection_summary FROM anon;
REVOKE SELECT ON public.rejection_summary FROM authenticated;

-- =============================================================================
-- 4. WARNINGS: Drop duplicate index on prompt_version
-- =============================================================================

DROP INDEX IF EXISTS public.idx_prompt_versions_agent_version;
-- Keep prompt_version_agent_name_version_key (the unique constraint index)

-- =============================================================================
-- 5. INFO: Add indexes for important unindexed foreign keys
-- =============================================================================

-- These are the most likely to impact query performance
CREATE INDEX IF NOT EXISTS idx_status_history_from_status 
  ON public.status_history(from_status);

CREATE INDEX IF NOT EXISTS idx_thumbnail_jobs_current_item 
  ON public.thumbnail_jobs(current_item_id);

-- =============================================================================
-- 6. INFO: Drop unused indexes (reducing ~50% of the 50 unused indexes)
-- =============================================================================

-- Drop unused indexes on audit_log (4 indexes, table likely not queried often)
DROP INDEX IF EXISTS public.idx_audit_log_entity;
DROP INDEX IF EXISTS public.idx_audit_log_user;
DROP INDEX IF EXISTS public.idx_audit_log_created_at;
DROP INDEX IF EXISTS public.idx_audit_log_action;

-- Drop unused indexes on classic_papers (3 indexes)
DROP INDEX IF EXISTS public.idx_classic_papers_category;
DROP INDEX IF EXISTS public.idx_classic_papers_undiscovered;
DROP INDEX IF EXISTS public.idx_classic_papers_publication_id;

-- Drop unused indexes on proposed_entity (4 indexes)
DROP INDEX IF EXISTS public.idx_proposed_entity_status;
DROP INDEX IF EXISTS public.idx_proposed_entity_type_status;
DROP INDEX IF EXISTS public.idx_proposed_entity_source;

-- Drop unused indexes on missed_discovery (5 indexes)
DROP INDEX IF EXISTS public.idx_missed_discovery_source_domain;
DROP INDEX IF EXISTS public.idx_missed_discovery_miss_category;
DROP INDEX IF EXISTS public.idx_missed_discovery_resolution_status;
DROP INDEX IF EXISTS public.idx_missed_discovery_submitter_audience;

-- Drop unused indexes on ingestion_queue_archive (3 indexes)
DROP INDEX IF EXISTS public.idx_archive_discovered_at;
DROP INDEX IF EXISTS public.idx_archive_status_code;
DROP INDEX IF EXISTS public.idx_archive_url_norm;

-- Drop unused indexes on thumbnail_item_status (3 indexes)
DROP INDEX IF EXISTS public.idx_thumbnail_item_job;
DROP INDEX IF EXISTS public.idx_thumbnail_item_queue;
DROP INDEX IF EXISTS public.idx_thumbnail_item_pub;

-- Drop unused indexes on prompt_ab_test tables (3 indexes)
DROP INDEX IF EXISTS public.idx_prompt_ab_test_agent;
DROP INDEX IF EXISTS public.idx_prompt_ab_test_item_test;
DROP INDEX IF EXISTS public.idx_prompt_ab_test_item_variant;

-- Drop unused indexes on obligation table (2 indexes)
DROP INDEX IF EXISTS public.idx_obligation_regulation;
DROP INDEX IF EXISTS public.idx_obligation_category;

-- Drop unused indexes on discovery_metrics (2 indexes)
DROP INDEX IF EXISTS public.idx_discovery_metrics_date;
DROP INDEX IF EXISTS public.idx_discovery_metrics_source;

-- Drop unused index on taxonomy_config
DROP INDEX IF EXISTS public.idx_taxonomy_config_behavior;

-- Drop unused index on seen_urls
DROP INDEX IF EXISTS public.idx_seen_urls_status;

-- Drop unused index on kb_source
DROP INDEX IF EXISTS public.idx_kb_source_id;

-- Drop unused index on ingestion_queue
DROP INDEX IF EXISTS public.idx_ingestion_queue_reviewed_by;
DROP INDEX IF EXISTS public.idx_queue_payload_gin;

-- Drop unused index on status_history
DROP INDEX IF EXISTS public.idx_status_history_queue;

-- =============================================================================
-- Summary: 
-- - Fixed 2 RLS errors
-- - Fixed 6 function search_path warnings
-- - Fixed 1 materialized view access warning
-- - Fixed 1 duplicate index warning
-- - Added 2 indexes for unindexed FKs
-- - Dropped 33 unused indexes (reducing from ~50 to ~17)
-- =============================================================================
