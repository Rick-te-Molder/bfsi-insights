-- Fix SECURITY DEFINER on review_queue_ready view
-- The view must use SECURITY INVOKER to enforce RLS policies of the querying user
-- https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view

DROP VIEW IF EXISTS public.review_queue_ready;

CREATE VIEW public.review_queue_ready
WITH (security_invoker = true) AS
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

COMMENT ON VIEW public.review_queue_ready IS 'Items ready for human review (status 300 with all pipeline steps complete)';
