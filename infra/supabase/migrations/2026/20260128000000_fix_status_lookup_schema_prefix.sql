-- Fix set_raw_expiration trigger to use fully qualified table names
-- 
-- Root Cause: The function has SET search_path = '' for security but was
-- querying status_lookup without the public. schema prefix, causing
-- "relation status_lookup does not exist" errors when called from
-- transition_status or other functions with empty search paths.
--
-- Related: KB-XXX (if applicable)

CREATE OR REPLACE FUNCTION public.set_raw_expiration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  rejected_codes int[];
  approved_codes int[];
BEGIN
  -- Get status codes dynamically from status_lookup (with schema prefix)
  SELECT array_agg(code) INTO rejected_codes
  FROM public.status_lookup WHERE name IN ('rejected', 'irrelevant', 'duplicate', 'failed');

  SELECT array_agg(code) INTO approved_codes
  FROM public.status_lookup WHERE name IN ('published');

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
$$;

COMMENT ON FUNCTION public.set_raw_expiration() IS 'Sets expires_at on ingestion_queue based on status transitions per ADR-004 retention policy. Uses fully qualified table names for compatibility with empty search_path.';
