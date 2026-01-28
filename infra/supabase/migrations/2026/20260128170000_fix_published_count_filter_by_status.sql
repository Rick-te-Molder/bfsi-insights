-- ============================================================================
-- Fix published count to only count items with status='published'
-- ============================================================================
-- Related to PR #693: https://github.com/Rick-te-Molder/bfsi-insights/pull/693
--
-- Bug: get_status_code_counts() was counting ALL rows in kb_publication,
-- including drafts and archived items. This caused the published count to
-- not increment when approving items (because total count stayed the same
-- when moving from draft to published).
--
-- Fix: Add WHERE status = 'published' filter to only count published items.

CREATE OR REPLACE FUNCTION public.get_status_code_counts()
RETURNS TABLE (
  code smallint,
  name text,
  category text,
  count bigint
) AS $$
DECLARE
  v_publication_count bigint;
BEGIN
  -- Get count of published items from kb_publication (only status='published')
  SELECT COUNT(*) INTO v_publication_count 
  FROM public.kb_publication 
  WHERE status = 'published';

  RETURN QUERY
  SELECT 
    sl.code,
    sl.name,
    sl.category,
    CASE 
      -- For "published" status (code 400), use kb_publication count
      WHEN sl.code = 400 THEN v_publication_count
      -- For all other statuses, count from ingestion_queue
      ELSE COALESCE(counts.cnt, 0)
    END AS count
  FROM public.status_lookup sl
  LEFT JOIN (
    SELECT 
      iq.status_code,
      COUNT(*) AS cnt
    FROM public.ingestion_queue iq
    WHERE iq.status_code IS NOT NULL
    GROUP BY iq.status_code
  ) counts ON sl.code = counts.status_code
  ORDER BY sl.sort_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';
