-- ============================================================================
-- Backfill kb_publication.published_at when missing
-- ============================================================================
--
-- Some older publications were created before published_at was standardized,
-- or were created from queue payloads that used legacy date_published fields.
-- This migration backfills published_at using:
-- 1) ingestion_queue.payload->>'published_at' via origin_queue_id
-- 2) ingestion_queue_archive.payload->>'published_at' via origin_queue_id
-- 3) added_at as a safe fallback
--
-- NOTE: We intentionally do not attempt to infer published_at from URLs or
-- content, to avoid accidental incorrect dates.

UPDATE public.kb_publication p
SET published_at = COALESCE(
  (
    SELECT (q.payload->>'published_at')::timestamptz
    FROM public.ingestion_queue q
    WHERE q.id = p.origin_queue_id
  ),
  (
    SELECT (qa.payload->>'published_at')::timestamptz
    FROM public.ingestion_queue_archive qa
    WHERE qa.id = p.origin_queue_id
  ),
  p.added_at
)
WHERE p.published_at IS NULL;
