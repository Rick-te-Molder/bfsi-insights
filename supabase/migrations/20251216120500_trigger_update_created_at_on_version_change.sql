-- ============================================================================
-- KB-258: Auto-update created_at when prompt version changes
-- This trigger ensures correct timestamps even if UPDATE is used instead of INSERT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_created_at_on_version_change()
RETURNS TRIGGER AS $$
BEGIN
  -- If version column changed, update created_at to now
  IF OLD.version IS DISTINCT FROM NEW.version THEN
    NEW.created_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists (for idempotency)
DROP TRIGGER IF EXISTS trigger_prompt_version_created_at ON prompt_version;

-- Create trigger on prompt_version table
CREATE TRIGGER trigger_prompt_version_created_at
  BEFORE UPDATE ON prompt_version
  FOR EACH ROW
  EXECUTE FUNCTION update_created_at_on_version_change();

COMMENT ON FUNCTION update_created_at_on_version_change IS 'KB-258: Auto-updates created_at when version column changes, ensuring correct timestamps even with UPDATE statements';
