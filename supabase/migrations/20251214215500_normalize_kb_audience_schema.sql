-- ============================================================================
-- KB-228: Normalize kb_audience schema to match other taxonomy tables
-- ============================================================================
-- Changes:
-- 1. Rename 'name' column to 'code' (identifier column)
-- 2. Rename 'label' column to 'name' (display name column)
-- 3. Update FK references in kb_source
-- 4. Update taxonomy_config to use new column names
-- 5. Update comments
--
-- This aligns kb_audience with other taxonomy tables (bfsi_industry, bfsi_topic, etc.)
-- which all use 'code' for identifier and 'name' for display label.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Drop dependent constraints (view doesn't directly reference kb_audience columns)
-- ============================================================================

-- Drop FK from kb_source that references kb_audience(name)
ALTER TABLE kb_source DROP CONSTRAINT IF EXISTS kb_source_primary_audience_fkey;

-- Drop the unique constraint on name (we'll recreate on code)
ALTER TABLE kb_audience DROP CONSTRAINT IF EXISTS kb_audience_name_unique;

-- ============================================================================
-- 2. Rename columns
-- ============================================================================

-- Rename 'name' to 'code' (the identifier column)
ALTER TABLE kb_audience RENAME COLUMN name TO code;

-- Rename 'label' to 'name' (the display name column)
ALTER TABLE kb_audience RENAME COLUMN label TO name;

-- ============================================================================
-- 3. Recreate constraints with new column names
-- ============================================================================

-- Add unique constraint on code
ALTER TABLE kb_audience ADD CONSTRAINT kb_audience_code_unique UNIQUE (code);

-- Recreate FK from kb_source referencing the new code column
ALTER TABLE kb_source ADD CONSTRAINT kb_source_primary_audience_fkey 
  FOREIGN KEY (primary_audience) REFERENCES kb_audience(code);

-- ============================================================================
-- 4. Update taxonomy_config to use new column names
-- ============================================================================

UPDATE taxonomy_config 
SET 
  source_code_column = 'code',
  source_name_column = 'name'
WHERE slug = 'audience';

-- Also update any audience_* scoring entries if they exist
UPDATE taxonomy_config 
SET 
  source_code_column = 'code',
  source_name_column = 'name'
WHERE source_table = 'kb_audience';

-- ============================================================================
-- 5. Update comments to reflect new column names
-- ============================================================================

COMMENT ON COLUMN kb_audience.code IS 'Unique slug identifier (executive, functional_specialist, engineer, researcher)';
COMMENT ON COLUMN kb_audience.name IS 'Human-readable display name';

COMMIT;
