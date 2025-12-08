-- KB-177: Add disabled_reason column to kb_source
-- Allows documenting why a source is disabled

-- Add column for explaining why a source is disabled
ALTER TABLE kb_source
ADD COLUMN disabled_reason TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN kb_source.disabled_reason IS 'Brief explanation of why source is disabled (e.g., "HTTP 403 blocked", "RSS feed removed")';

-- Disable SSRN with reason
UPDATE kb_source
SET 
  enabled = FALSE,
  disabled_reason = 'HTTP 403 - SSRN blocks automated access. May need proxy or alternative academic source.'
WHERE name = 'SSRN';
