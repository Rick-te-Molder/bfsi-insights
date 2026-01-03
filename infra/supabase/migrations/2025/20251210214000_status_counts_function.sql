-- Function to get status code counts directly from the database
-- This ensures MECE counts straight from Supabase

CREATE OR REPLACE FUNCTION get_status_code_counts()
RETURNS TABLE (
  code smallint,
  name text,
  category text,
  count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sl.code,
    sl.name,
    sl.category,
    COALESCE(counts.cnt, 0) AS count
  FROM status_lookup sl
  LEFT JOIN (
    SELECT 
      iq.status_code,
      COUNT(*) AS cnt
    FROM ingestion_queue iq
    WHERE iq.status_code IS NOT NULL
    GROUP BY iq.status_code
  ) counts ON sl.code = counts.status_code
  ORDER BY sl.sort_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated and service_role
GRANT EXECUTE ON FUNCTION get_status_code_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION get_status_code_counts() TO service_role;
