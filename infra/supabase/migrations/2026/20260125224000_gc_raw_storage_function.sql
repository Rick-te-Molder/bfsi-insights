-- US-6: Garbage Collection Job
-- ADR-004: Raw Data Storage Strategy
--
-- Database function to find raw_refs that are safe to delete
-- Reference-safe: only deletes refs where ALL rows are expired and not in live status

-- Function to find safe-to-delete raw_refs
CREATE OR REPLACE FUNCTION find_safe_to_delete_raw_refs(batch_limit int DEFAULT 100)
RETURNS TABLE(raw_ref text) AS $$
BEGIN
  RETURN QUERY
  WITH expired_refs AS (
    -- Find distinct raw_refs where at least one row is expired
    SELECT DISTINCT iq.raw_ref
    FROM ingestion_queue iq
    WHERE iq.expires_at < now()
      AND iq.storage_deleted_at IS NULL
      AND iq.raw_ref IS NOT NULL
  ),
  safe_to_delete AS (
    -- Filter to only refs where NO row has a live status
    SELECT e.raw_ref
    FROM expired_refs e
    WHERE NOT EXISTS (
      SELECT 1 FROM ingestion_queue iq
      JOIN status_lookup sl ON iq.status_code = sl.code
      WHERE iq.raw_ref = e.raw_ref
        AND sl.status IN ('approved', 'published', 'pending', 'to_summarize', 'to_tag', 'to_review', 'summarized', 'tagged')
    )
    LIMIT batch_limit
  )
  SELECT s.raw_ref FROM safe_to_delete s;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment for documentation
COMMENT ON FUNCTION find_safe_to_delete_raw_refs(int) IS 
'Finds raw_refs safe to delete: expired and not referenced by any live-status rows. Used by GC job.';

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION find_safe_to_delete_raw_refs(int) TO service_role;
