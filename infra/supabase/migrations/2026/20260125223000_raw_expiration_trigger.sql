-- US-5: Retention Policy — Set Expiration on Status Change
-- ADR-004: Raw Data Storage Strategy
--
-- Sets expires_at on ingestion_queue based on status transitions:
-- - rejected: 14 days
-- - approved/published: null (indefinite)
-- - pending (insert): 90 days

-- Function to set raw content expiration based on status
CREATE OR REPLACE FUNCTION set_raw_expiration()
RETURNS TRIGGER AS $$
DECLARE
  rejected_codes int[];
  approved_codes int[];
BEGIN
  -- Get status codes dynamically from status_lookup
  SELECT array_agg(code) INTO rejected_codes
  FROM status_lookup WHERE status IN ('rejected', 'irrelevant', 'duplicate', 'error');

  SELECT array_agg(code) INTO approved_codes
  FROM status_lookup WHERE status IN ('approved', 'published');

  -- Set expiration based on status
  IF NEW.status_code = ANY(rejected_codes) THEN
    -- Rejected items expire in 14 days
    NEW.expires_at := now() + interval '14 days';
  ELSIF NEW.status_code = ANY(approved_codes) THEN
    -- Approved/published items never expire
    NEW.expires_at := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    -- New pending items get 90 days default
    NEW.expires_at := COALESCE(NEW.expires_at, now() + interval '90 days');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON FUNCTION set_raw_expiration() IS 
'Sets expires_at on ingestion_queue based on status transitions per ADR-004 retention policy';

-- Create trigger on ingestion_queue
DROP TRIGGER IF EXISTS trg_set_raw_expiration ON ingestion_queue;

CREATE TRIGGER trg_set_raw_expiration
BEFORE INSERT OR UPDATE OF status_code ON ingestion_queue
FOR EACH ROW EXECUTE FUNCTION set_raw_expiration();

-- Add comment for documentation
COMMENT ON TRIGGER trg_set_raw_expiration ON ingestion_queue IS 
'Automatically sets expires_at based on status transitions per ADR-004 retention policy';
