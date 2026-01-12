ALTER TABLE public.kb_publication RENAME COLUMN date_published TO published_at;
ALTER TABLE public.kb_publication RENAME COLUMN date_added TO added_at;
ALTER TABLE public.kb_publication RENAME COLUMN last_edited TO last_edited_at;

ALTER INDEX IF EXISTS public.idx_kb_publication_date_added RENAME TO idx_kb_publication_added_at;

DROP VIEW IF EXISTS public.kb_publication_pretty;
CREATE VIEW public.kb_publication_pretty
WITH (security_invoker = true)
AS
SELECT 
  p.id,
  p.slug,
  p.title,
  p.author,
  p.published_at,
  p.added_at,
  p.last_edited_at,
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
  p.audience,
  p.geography,
  p.status,
  (SELECT pi.industry_code 
   FROM public.kb_publication_bfsi_industry pi 
   WHERE pi.publication_id = p.id 
   ORDER BY pi.rank NULLS LAST 
   LIMIT 1) as industry,
  (SELECT pt.topic_code 
   FROM public.kb_publication_bfsi_topic pt 
   WHERE pt.publication_id = p.id 
   ORDER BY pt.rank NULLS LAST 
   LIMIT 1) as topic,
  COALESCE((SELECT array_agg(pi.industry_code ORDER BY pi.rank NULLS LAST)
   FROM public.kb_publication_bfsi_industry pi WHERE pi.publication_id = p.id), '{}') as industries,
  COALESCE((SELECT array_agg(pt.topic_code ORDER BY pt.rank NULLS LAST)
   FROM public.kb_publication_bfsi_topic pt WHERE pt.publication_id = p.id), '{}') as topics,
  COALESCE((SELECT array_agg(pr.regulator_code)
   FROM public.kb_publication_regulator pr WHERE pr.publication_id = p.id), '{}') as regulators,
  COALESCE((SELECT array_agg(preg.regulation_code)
   FROM public.kb_publication_regulation preg WHERE preg.publication_id = p.id), '{}') as regulations,
  COALESCE((SELECT array_agg(po.obligation_code)
   FROM public.kb_publication_obligation po WHERE po.publication_id = p.id), '{}') as obligations,
  COALESCE((SELECT array_agg(pp.process_code)
   FROM public.kb_publication_bfsi_process pp WHERE pp.publication_id = p.id), '{}') as processes
FROM public.kb_publication p
WHERE p.status = 'published';

GRANT SELECT ON public.kb_publication_pretty TO anon, authenticated;

ALTER TABLE public.ingestion_queue RENAME COLUMN last_modified TO last_modified_at;
ALTER TABLE public.ingestion_queue_archive RENAME COLUMN last_modified TO last_modified_at;

-- NOTE: Do NOT drop/recreate other queue views here.
-- They mostly select iq.* and remain compatible after renaming last_modified -> last_modified_at.

-- Update archive function to use renamed column last_modified_at
CREATE OR REPLACE FUNCTION public.archive_old_queue_items(days_old int DEFAULT 90)
RETURNS TABLE(archived_count int, seen_urls_count int, oldest_remaining timestamptz) AS $$
DECLARE
  v_cutoff timestamptz;
  v_archived int;
  v_seen int;
  v_oldest timestamptz;
BEGIN
  v_cutoff := now() - (days_old || ' days')::interval;
  
  WITH moved AS (
    DELETE FROM public.ingestion_queue
    WHERE discovered_at < v_cutoff
      AND status_code IN (500, 600, 700)
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
    id, url, url_norm, content_hash,
    status, status_code, content_type, entry_type,
    payload, payload_schema_version,
    raw_ref, thumb_ref,
    etag, last_modified_at,
    discovered_at, fetched_at, reviewed_at, approved_at,
    reviewer, rejection_reason,
    prompt_version, model_id, agent_metadata
  FROM moved;
  
  GET DIAGNOSTICS v_archived = ROW_COUNT;
  
  INSERT INTO public.seen_urls (url_norm, first_seen_at, final_status_code)
  SELECT url_norm, discovered_at, status_code
  FROM public.ingestion_queue_archive
  WHERE archived_at >= now() - interval '1 minute'
    AND status_code IN (500, 600)
  ON CONFLICT (url_norm) DO NOTHING;
  
  GET DIAGNOSTICS v_seen = ROW_COUNT;
  
  SELECT MIN(discovered_at) INTO v_oldest FROM public.ingestion_queue;
  
  archived_count := v_archived;
  seen_urls_count := v_seen;
  oldest_remaining := v_oldest;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;
