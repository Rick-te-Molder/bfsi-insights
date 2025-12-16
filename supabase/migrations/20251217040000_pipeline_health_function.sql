-- KB-270: Pipeline health dashboard SQL function
-- Aggregates step performance stats for last 24 hours

CREATE OR REPLACE FUNCTION get_step_stats_24h()
RETURNS TABLE (
  step_name TEXT,
  avg_duration_ms NUMERIC,
  success_count BIGINT,
  failed_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    psr.step_name,
    COALESCE(AVG(
      EXTRACT(EPOCH FROM (psr.completed_at - psr.started_at)) * 1000
    ), 0)::NUMERIC AS avg_duration_ms,
    COUNT(*) FILTER (WHERE psr.status = 'success') AS success_count,
    COUNT(*) FILTER (WHERE psr.status = 'failed') AS failed_count
  FROM pipeline_step_run psr
  WHERE psr.completed_at >= NOW() - INTERVAL '24 hours'
    AND psr.completed_at IS NOT NULL
    AND psr.started_at IS NOT NULL
  GROUP BY psr.step_name
  ORDER BY psr.step_name;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_step_stats_24h() IS 'KB-270: Returns step performance stats for pipeline health dashboard';
