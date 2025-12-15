-- ============================================================================
-- KB-248: Add automated eval runs on prompt version changes
-- ============================================================================
-- Links eval_run to specific prompt_version and adds trigger status tracking
-- ============================================================================

-- Add prompt_version_id to eval_run for direct linking
ALTER TABLE eval_run 
ADD COLUMN IF NOT EXISTS prompt_version_id UUID REFERENCES prompt_version(id);

-- Add trigger_type to indicate how the eval was triggered
ALTER TABLE eval_run 
ADD COLUMN IF NOT EXISTS trigger_type TEXT 
CHECK (trigger_type IN ('manual', 'auto_on_change', 'scheduled'));

-- Add baseline comparison columns
ALTER TABLE eval_run 
ADD COLUMN IF NOT EXISTS baseline_score NUMERIC(5,4);

ALTER TABLE eval_run 
ADD COLUMN IF NOT EXISTS score_delta NUMERIC(5,4);

ALTER TABLE eval_run 
ADD COLUMN IF NOT EXISTS regression_detected BOOLEAN DEFAULT false;

-- Index for quick lookups by prompt version
CREATE INDEX IF NOT EXISTS idx_eval_run_prompt_version 
ON eval_run(prompt_version_id) 
WHERE prompt_version_id IS NOT NULL;

-- Add last_eval columns to prompt_version for quick status display
ALTER TABLE prompt_version 
ADD COLUMN IF NOT EXISTS last_eval_run_id UUID REFERENCES eval_run(id);

ALTER TABLE prompt_version 
ADD COLUMN IF NOT EXISTS last_eval_score NUMERIC(5,4);

ALTER TABLE prompt_version 
ADD COLUMN IF NOT EXISTS last_eval_status TEXT 
CHECK (last_eval_status IN ('pending', 'running', 'passed', 'warning', 'failed'));

ALTER TABLE prompt_version 
ADD COLUMN IF NOT EXISTS last_eval_at TIMESTAMPTZ;

-- Comments
COMMENT ON COLUMN eval_run.prompt_version_id IS 'Links eval run to specific prompt version';
COMMENT ON COLUMN eval_run.trigger_type IS 'How eval was triggered: manual, auto_on_change, scheduled';
COMMENT ON COLUMN eval_run.baseline_score IS 'Score from previous version for comparison';
COMMENT ON COLUMN eval_run.score_delta IS 'Difference from baseline (positive = improvement)';
COMMENT ON COLUMN eval_run.regression_detected IS 'True if score dropped significantly from baseline';

COMMENT ON COLUMN prompt_version.last_eval_run_id IS 'Most recent eval run for this version';
COMMENT ON COLUMN prompt_version.last_eval_score IS 'Score from most recent eval (0-1)';
COMMENT ON COLUMN prompt_version.last_eval_status IS 'Status: passed (>=baseline), warning (<baseline), failed (regression)';
COMMENT ON COLUMN prompt_version.last_eval_at IS 'Timestamp of last eval run';

-- =============================================================================
-- Function to update prompt_version after eval completes
-- =============================================================================

CREATE OR REPLACE FUNCTION update_prompt_eval_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update when eval finishes (status changes to success or failed)
  IF NEW.status IN ('success', 'failed') AND OLD.status = 'running' THEN
    -- Update the prompt_version with eval results
    IF NEW.prompt_version_id IS NOT NULL THEN
      UPDATE prompt_version SET
        last_eval_run_id = NEW.id,
        last_eval_score = NEW.score,
        last_eval_status = CASE
          WHEN NEW.status = 'failed' THEN 'failed'
          WHEN NEW.regression_detected THEN 'warning'
          WHEN NEW.score >= 0.8 THEN 'passed'
          WHEN NEW.score >= 0.6 THEN 'warning'
          ELSE 'failed'
        END,
        last_eval_at = NEW.finished_at
      WHERE id = NEW.prompt_version_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-update prompt_version when eval completes
DROP TRIGGER IF EXISTS update_prompt_eval_status_trigger ON eval_run;
CREATE TRIGGER update_prompt_eval_status_trigger
  AFTER UPDATE ON eval_run
  FOR EACH ROW
  EXECUTE FUNCTION update_prompt_eval_status();

COMMENT ON FUNCTION update_prompt_eval_status IS 'Updates prompt_version eval status when eval_run completes';

-- =============================================================================
-- View for prompt eval status (for admin UI)
-- =============================================================================

CREATE OR REPLACE VIEW v_prompt_eval_status
WITH (security_invoker = true) AS
SELECT 
  pv.id,
  pv.agent_name,
  pv.version,
  pv.is_current,
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

COMMENT ON VIEW v_prompt_eval_status IS 'Prompt versions with their latest eval status';
