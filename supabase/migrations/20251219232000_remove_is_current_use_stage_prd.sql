-- ============================================================================
-- Migration: Remove is_current column, use stage='PRD' as single source of truth
-- ============================================================================
-- Root cause: is_current and stage can be out of sync, causing confusion
-- Solution: stage='PRD' means the version is active/live/current
-- The unique constraint idx_prompt_version_unique_prd ensures only one PRD per agent
-- ============================================================================

-- 1. For each agent where is_current=true but stage != 'PRD':
--    - First retire the old PRD version
--    - Then promote the is_current version to PRD
--    Must be done in this order to avoid unique constraint violation

-- Step 1a: Retire all PRD versions where a different version has is_current=true
UPDATE prompt_version
SET stage = 'RET', retired_at = NOW()
WHERE stage = 'PRD'
  AND agent_name IN (
    SELECT agent_name 
    FROM prompt_version 
    WHERE is_current = true AND stage != 'PRD'
  );

-- Step 1b: Now promote is_current versions to PRD (safe now that old PRDs are retired)
UPDATE prompt_version
SET stage = 'PRD', deployed_at = NOW()
WHERE is_current = true AND stage != 'PRD';

-- 2. Ensure all stage='PRD' versions have is_current=true (for safety during transition)
UPDATE prompt_version
SET is_current = true
WHERE stage = 'PRD' AND is_current = false;

-- 3. Drop the unique index on is_current (no longer needed)
DROP INDEX IF EXISTS prompt_version_one_current_per_agent;

-- 4. Recreate v_prompt_eval_status view without is_current column
DROP VIEW IF EXISTS v_prompt_eval_status;

CREATE OR REPLACE VIEW v_prompt_eval_status
WITH (security_invoker = true) AS
SELECT 
  pv.id,
  pv.agent_name,
  pv.version,
  pv.stage,
  pv.last_eval_status,
  pv.last_eval_score,
  pv.last_eval_at,
  er.eval_type,
  er.passed,
  er.failed,
  er.total_examples,
  er.baseline_score,
  er.score_delta,
  er.regression_detected
FROM prompt_version pv
LEFT JOIN eval_run er ON er.id = pv.last_eval_run_id;

COMMENT ON VIEW v_prompt_eval_status IS 'Prompt versions with their latest eval status (stage=PRD means active/live)';

-- 5. Drop the is_current column
ALTER TABLE prompt_version DROP COLUMN is_current;

-- 6. Add comment to clarify new behavior
COMMENT ON COLUMN prompt_version.stage IS 'Deployment stage: DEV (draft), TST (testing), PRD (active/live), RET (retired). Only one PRD version per agent (enforced by idx_prompt_version_unique_prd).';
