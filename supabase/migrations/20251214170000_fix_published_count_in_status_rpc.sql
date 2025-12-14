-- Fix get_status_code_counts to include kb_publication count for "published" category
-- KB-220: Dashboard shows zero published items
--
-- The issue: published items are in kb_publication table, not ingestion_queue
-- The RPC only counted ingestion_queue, so "published" always showed 0

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
  -- Get count of published items from kb_publication
  SELECT COUNT(*) INTO v_publication_count FROM public.kb_publication;

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
