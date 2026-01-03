-- ============================================================================
-- KB-165: Fix Supabase linter issues (v2)
-- ============================================================================
-- Issues:
-- 1. ERROR: Security Definer View on kb_publication_pretty
-- 2. WARN: Multiple permissive SELECT policies on obligation tables
-- 3. INFO: 24 unused indexes (kept for future use, commented for reference)
-- ============================================================================

-- ============================================================================
-- 1. FIX: Security Definer View
-- ============================================================================
-- Ensure kb_publication_pretty uses security_invoker = true
-- This must be done after any other migration that recreates the view

DROP VIEW IF EXISTS kb_publication_pretty;
CREATE VIEW kb_publication_pretty
WITH (security_invoker = true)
AS
SELECT 
  p.id,
  p.slug,
  p.title,
  p.author,
  p.date_published,
  p.source_url,
  p.source_name,
  p.source_domain,
  p.thumbnail,
  p.thumbnail_bucket,
  p.thumbnail_path,
  p.summary_short,
  p.summary_medium,
  p.summary_long,
  p.content_type,
  p.role,
  p.geography,
  p.status,
  -- Primary industry/topic
  (SELECT pi.industry_code 
   FROM kb_publication_bfsi_industry pi 
   WHERE pi.publication_id = p.id 
   ORDER BY pi.rank NULLS LAST 
   LIMIT 1) as industry,
  (SELECT pt.topic_code 
   FROM kb_publication_bfsi_topic pt 
   WHERE pt.publication_id = p.id 
   ORDER BY pt.rank NULLS LAST 
   LIMIT 1) as topic,
  -- Arrays
  COALESCE((SELECT array_agg(pi.industry_code ORDER BY pi.rank NULLS LAST)
   FROM kb_publication_bfsi_industry pi WHERE pi.publication_id = p.id), '{}') as industries,
  COALESCE((SELECT array_agg(pt.topic_code ORDER BY pt.rank NULLS LAST)
   FROM kb_publication_bfsi_topic pt WHERE pt.publication_id = p.id), '{}') as topics,
  COALESCE((SELECT array_agg(pr.regulator_code)
   FROM kb_publication_regulator pr WHERE pr.publication_id = p.id), '{}') as regulators,
  COALESCE((SELECT array_agg(preg.regulation_code)
   FROM kb_publication_regulation preg WHERE preg.publication_id = p.id), '{}') as regulations,
  COALESCE((SELECT array_agg(po.obligation_code)
   FROM kb_publication_obligation po WHERE po.publication_id = p.id), '{}') as obligations,
  COALESCE((SELECT array_agg(pp.process_code)
   FROM kb_publication_bfsi_process pp WHERE pp.publication_id = p.id), '{}') as processes
FROM kb_publication p
WHERE p.status = 'published';

GRANT SELECT ON kb_publication_pretty TO anon, authenticated;

-- ============================================================================
-- 2. FIX: Multiple Permissive Policies
-- ============================================================================
-- Problem: Both *_read_all (SELECT) and *_write_service (ALL) grant SELECT
-- Solution: Change write_service from FOR ALL to FOR INSERT, UPDATE, DELETE

-- Fix obligation table policies
DROP POLICY IF EXISTS "obligation_write_service" ON obligation;
CREATE POLICY "obligation_insert_service" ON obligation 
  FOR INSERT 
  WITH CHECK ((select auth.role()) = 'service_role');
CREATE POLICY "obligation_update_service" ON obligation 
  FOR UPDATE 
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');
CREATE POLICY "obligation_delete_service" ON obligation 
  FOR DELETE 
  USING ((select auth.role()) = 'service_role');

-- Fix kb_publication_obligation table policies
DROP POLICY IF EXISTS "pub_obligation_write_service" ON kb_publication_obligation;
CREATE POLICY "pub_obligation_insert_service" ON kb_publication_obligation 
  FOR INSERT 
  WITH CHECK ((select auth.role()) = 'service_role');
CREATE POLICY "pub_obligation_update_service" ON kb_publication_obligation 
  FOR UPDATE 
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');
CREATE POLICY "pub_obligation_delete_service" ON kb_publication_obligation 
  FOR DELETE 
  USING ((select auth.role()) = 'service_role');

-- ============================================================================
-- 3. INFO: Unused Indexes (not dropped - may be needed for future queries)
-- ============================================================================
-- The following indexes have not been used yet but may be useful:
-- - idx_discovery_metrics_date, idx_discovery_metrics_source
-- - idx_classic_papers_undiscovered, idx_classic_papers_category, idx_classic_papers_publication_id
-- - idx_agent_run_publication_id, idx_agent_run_stg_id
-- - idx_obligation_regulation, idx_obligation_category
-- - idx_pub_obligation_code
-- - idx_kb_pub_regulator_code, idx_kb_pub_regulation_code
-- - idx_ag_use_case_capability_capability_id
-- - idx_agent_run_step_run_id
-- - idx_bfsi_process_parent_code, idx_bfsi_topic_parent_code
-- - idx_eval_run_golden_set_id, idx_eval_result_run_id
-- - idx_kb_publication_ag_vendor_vendor_id
-- - idx_kb_publication_bfsi_organization_org_id
-- - idx_kb_publication_standard_standard_id
-- - idx_rejection_analytics_prompt_version
-- - idx_standard_regulator_id, idx_standard_standard_setter_id
--
-- These are INFO level warnings and don't require immediate action.
-- Keep for now as the system scales and queries evolve.
