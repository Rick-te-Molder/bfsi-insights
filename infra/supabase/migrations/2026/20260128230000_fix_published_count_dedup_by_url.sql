-- ============================================================================
-- Fix published count to deduplicate by URL instead of summing both tables
-- ============================================================================
--
-- Bug: get_status_code_counts() was summing kb_publication + ingestion_queue
-- for status 400, but many items exist in BOTH tables, causing double-counting.
--
-- Example:
-- - kb_publication has 144 items with status='published'
-- - ingestion_queue has 18 items with status_code=400
-- - But 18 of the kb_publication items ALSO have queue entries
-- - Old RPC: 144 + 18 = 162 (WRONG - double counts 18 items)
-- - Correct: 144 unique items (deduplicated by URL)
--
-- Fix: Use DISTINCT on URL to avoid counting the same item twice

CREATE OR REPLACE FUNCTION public.get_status_code_counts()
RETURNS TABLE (
  code smallint,
  name text,
  category text,
  count bigint
) AS $$
DECLARE
  v_published_count bigint;
BEGIN
  -- Count DISTINCT published items by URL (deduplicated across both tables)
  SELECT COUNT(DISTINCT url) INTO v_published_count
  FROM (
    -- Published items from kb_publication
    SELECT source_url as url 
    FROM public.kb_publication 
    WHERE status = 'published'
    
    UNION
    
    -- Published items from ingestion_queue
    SELECT url 
    FROM public.ingestion_queue
    WHERE status_code = 400
  ) combined;

  RETURN QUERY
  SELECT 
    sl.code,
    sl.name,
    sl.category,
    CASE 
      -- For "published" status (code 400), use deduplicated count
      WHEN sl.code = 400 THEN v_published_count
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
      AND iq.status_code != 400
    GROUP BY iq.status_code
  ) counts ON sl.code = counts.status_code
  ORDER BY sl.sort_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';
