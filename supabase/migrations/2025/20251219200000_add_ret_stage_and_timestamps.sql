-- ============================================================================
-- Migration: Add RET stage and timestamp tracking for prompt versions
-- ============================================================================
-- 1. Add RET (Retired) stage to PromptStage enum
-- 2. Add deployed_at and retired_at timestamp columns
-- 3. Add unique constraint for PRD stage (only one PRD per agent)
-- 4. Migrate existing data to use RET stage
-- ============================================================================

-- 1. Add deployed_at and retired_at columns
ALTER TABLE prompt_version
ADD COLUMN deployed_at TIMESTAMPTZ,
ADD COLUMN retired_at TIMESTAMPTZ;

-- 2. Update existing data: mark non-current PRD versions as RET
-- First, set deployed_at for current PRD versions (use created_at as approximation)
UPDATE prompt_version
SET deployed_at = created_at
WHERE stage = 'PRD' AND is_current = true;

-- Mark all non-current versions with stage='PRD' as RET
UPDATE prompt_version
SET stage = 'RET', retired_at = created_at
WHERE stage = 'PRD' AND is_current = false;

-- 3. Add unique constraint: only one PRD version per agent
-- This ensures data integrity going forward
CREATE UNIQUE INDEX idx_prompt_version_unique_prd 
ON prompt_version (agent_name) 
WHERE stage = 'PRD';

-- 4. Add comment to document the constraint
COMMENT ON INDEX idx_prompt_version_unique_prd IS 
'Ensures only one PRD version per agent at a time. When promoting to PRD, old PRD must be moved to RET first.';

-- 5. Verification query (run after migration)
-- SELECT 
--   agent_name,
--   version,
--   stage,
--   is_current,
--   deployed_at,
--   retired_at,
--   created_at
-- FROM prompt_version
-- WHERE stage IN ('PRD', 'RET')
-- ORDER BY agent_name, created_at DESC;
