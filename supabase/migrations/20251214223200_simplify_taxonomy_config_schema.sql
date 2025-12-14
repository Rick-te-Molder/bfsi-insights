-- ============================================================================
-- KB-233: Simplify taxonomy_config schema
-- ============================================================================
-- Now that all taxonomy tables use standardized 'code' and 'name' columns
-- (thanks to KB-228), we no longer need source_code_column and source_name_column.
-- ============================================================================

-- Drop the redundant columns
ALTER TABLE taxonomy_config DROP COLUMN IF EXISTS source_code_column;
ALTER TABLE taxonomy_config DROP COLUMN IF EXISTS source_name_column;

-- Add comment explaining the standardization
COMMENT ON TABLE taxonomy_config IS 'Central registry for all tag categories. All source tables must use ''code'' and ''name'' columns (standardized in KB-228).';
