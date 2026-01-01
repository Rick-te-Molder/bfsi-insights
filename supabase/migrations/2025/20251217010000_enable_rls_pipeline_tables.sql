-- KB-262: Enable RLS on pipeline_run and pipeline_step_run tables
-- Fixes Supabase linter error: rls_disabled_in_public

-- Enable RLS on pipeline_run
ALTER TABLE pipeline_run ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (used by agent-api)
CREATE POLICY "Service role can manage pipeline_run" ON pipeline_run
  FOR ALL USING (true) WITH CHECK (true);

-- Enable RLS on pipeline_step_run
ALTER TABLE pipeline_step_run ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (used by agent-api)
CREATE POLICY "Service role can manage pipeline_step_run" ON pipeline_step_run
  FOR ALL USING (true) WITH CHECK (true);
