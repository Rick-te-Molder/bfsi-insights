-- ============================================================================
-- KB-229: Connect scoring taxonomy_config entries to their source tables
-- ============================================================================
-- This enables UI components to dynamically fetch display labels from the
-- single source of truth (kb_audience) instead of using duplicated display_name values.
-- ============================================================================

-- Update audience scoring rows to reference kb_audience table
-- After KB-228, kb_audience uses 'code' and 'name' columns (standard pattern)
UPDATE taxonomy_config 
SET 
  source_table = 'kb_audience',
  source_code_column = 'code',
  source_name_column = 'name'
WHERE slug LIKE 'audience_%' 
  AND behavior_type = 'scoring';

-- Add comment explaining the relationship
COMMENT ON COLUMN taxonomy_config.source_table IS 'Source table for taxonomy data. For scoring types like audience_*, this points to the table containing display labels.';
