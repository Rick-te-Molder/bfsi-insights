-- ============================================================================
-- Update ingestion_queue archival retention windows
-- ============================================================================
-- Requirement:
-- - Keep published/approved/rejected queue items for 1 year (365 days)
-- - Keep failed queue items for 180 days
--
-- IMPORTANT:
-- - Always load status codes from status_lookup (single source of truth)
-- - Do not hardcode status codes

CREATE OR REPLACE FUNCTION public.archive_old_queue_items(days_old int DEFAULT 365)
RETURNS TABLE(archived_count int, seen_urls_count int, oldest_remaining timestamptz) AS $$
DECLARE
  v_cutoff_terminal timestamptz;
  v_cutoff_failed timestamptz;
  v_archived int;
  v_seen int;
  v_oldest timestamptz;

  v_status_approved smallint;
  v_status_published smallint;
  v_status_rejected smallint;
  v_status_failed smallint;
BEGIN
  -- Retention windows
  v_cutoff_terminal := now() - (days_old || ' days')::interval;
  v_cutoff_failed := now() - (180 || ' days')::interval;

  -- Load status codes from status_lookup
  SELECT code INTO v_status_approved FROM public.status_lookup WHERE name = 'approved';
  SELECT code INTO v_status_published FROM public.status_lookup WHERE name = 'published';
  SELECT code INTO v_status_rejected FROM public.status_lookup WHERE name = 'rejected';
  SELECT code INTO v_status_failed FROM public.status_lookup WHERE name = 'failed';

  -- Step 1: Move old terminal items to archive
  WITH moved AS (
    DELETE FROM public.ingestion_queue
    WHERE (
      discovered_at < v_cutoff_terminal
      AND status_code IN (v_status_approved, v_status_published, v_status_rejected)
    ) OR (
      discovered_at < v_cutoff_failed
      AND status_code = v_status_failed
    )
    RETURNING *
  )
  INSERT INTO public.ingestion_queue_archive (
    id, url, url_norm, content_hash,
    status, status_code, content_type, entry_type,
    payload, payload_schema_version,
    raw_ref, thumb_ref,
    etag, last_modified_at,
    discovered_at, fetched_at, reviewed_at, approved_at,
    reviewer, rejection_reason,
    prompt_version, model_id, agent_metadata
  )
  SELECT 
    m.id, m.url, m.url_norm, m.content_hash,
    sl.name as status, m.status_code, m.content_type, m.entry_type,
    m.payload, m.payload_schema_version,
    m.raw_ref, m.thumb_ref,
    m.etag, m.last_modified_at,
    m.discovered_at, m.fetched_at, m.reviewed_at, m.approved_at,
    m.reviewer, m.rejection_reason,
    m.prompt_version, m.model_id, m.agent_metadata
  FROM moved m
  LEFT JOIN public.status_lookup sl ON sl.code = m.status_code;

  GET DIAGNOSTICS v_archived = ROW_COUNT;

  -- Step 2: Add approved/published items to seen_urls (NOT rejected, NOT failed)
  INSERT INTO public.seen_urls (url_norm, first_seen_at, final_status_code)
  SELECT url_norm, discovered_at, status_code
  FROM public.ingestion_queue_archive
  WHERE archived_at >= now() - interval '1 minute'
    AND status_code IN (v_status_approved, v_status_published)
  ON CONFLICT (url_norm) DO NOTHING;

  GET DIAGNOSTICS v_seen = ROW_COUNT;

  -- Get oldest remaining item timestamp
  SELECT MIN(discovered_at) INTO v_oldest FROM public.ingestion_queue;

  archived_count := v_archived;
  seen_urls_count := v_seen;
  oldest_remaining := v_oldest;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = '';

COMMENT ON FUNCTION public.archive_old_queue_items(int) IS
E'Archives ingestion_queue rows:\\n- approved/published/rejected older than N days (default 365)\\n- failed older than 180 days\\nAdds only approved/published to seen_urls. Usage: SELECT * FROM public.archive_old_queue_items();';

COMMENT ON TABLE public.ingestion_queue IS E'Lightweight queue for discovery, enrichment, and review.\\n\\nRETENTION POLICY:\\n- Items with terminal status (approved/rejected/published) older than 365 days are archived\\n- Failed items older than 180 days are archived\\n- Run: SELECT * FROM public.archive_old_queue_items();\\n- Pending/in-progress items are NEVER archived\\n- Approved/published items are added to seen_urls (prevents re-discovery)\\n- Rejected and failed items are NOT added to seen_urls (allows re-evaluation)\\n\\nSee status_lookup for status_code definitions.';
