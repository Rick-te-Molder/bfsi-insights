-- ============================================================================
-- Fix published count to include items with status 400 in ingestion_queue
-- ============================================================================
-- Related to PR #696
--
-- Bug: get_status_code_counts() only counted kb_publication for status 400,
-- but ignored items in ingestion_queue with status_code = 400. This caused
-- approved items to not be counted until they were in kb_publication.
--
-- When approving an item:
-- 1. Item gets status_code = 400 in ingestion_queue
-- 2. Item gets inserted into kb_publication with status = 'published'
-- 3. Old RPC only counted kb_publication, missing queue items
--
-- Fix: Count BOTH sources for status 400:
-- - Items in kb_publication with status = 'published'
-- - Items in ingestion_queue with status_code = 400

CREATE OR REPLACE FUNCTION public.get_status_code_counts()
RETURNS TABLE (
  code smallint,
  name text,
  category text,
  count bigint
) AS $$
DECLARE
  v_publication_count bigint;
  v_queue_published_count bigint;
BEGIN
  -- Get count of published items from kb_publication (only status='published')
  SELECT COUNT(*) INTO v_publication_count 
  FROM public.kb_publication 
  WHERE status = 'published';
  
  -- Get count of items with status_code = 400 in ingestion_queue
  SELECT COUNT(*) INTO v_queue_published_count
  FROM public.ingestion_queue
  WHERE status_code = 400;

  RETURN QUERY
  SELECT 
    sl.code,
    sl.name,
    sl.category,
    CASE 
      -- For "published" status (code 400), count from BOTH sources
      WHEN sl.code = 400 THEN v_publication_count + v_queue_published_count
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
      AND iq.status_code != 400  -- Exclude 400 since we count it separately above
    GROUP BY iq.status_code
  ) counts ON sl.code = counts.status_code
  ORDER BY sl.sort_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';
