-- Evals Framework Tables
-- Supports: Golden datasets, LLM-as-judge, A/B prompt testing

-- Golden dataset examples (human-verified test cases)
CREATE TABLE IF NOT EXISTS eval_golden_set (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL,
  name TEXT NOT NULL, -- e.g., "filter_relevance_v1"
  description TEXT,
  
  -- Input to the agent
  input JSONB NOT NULL,
  
  -- Expected output (human-verified)
  expected_output JSONB NOT NULL,
  
  -- Metadata
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Individual eval runs
CREATE TABLE IF NOT EXISTS eval_run (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  
  -- What type of eval
  eval_type TEXT NOT NULL CHECK (eval_type IN ('golden', 'llm_judge', 'ab_test')),
  
  -- Reference to golden set (if applicable)
  golden_set_id UUID REFERENCES eval_golden_set(id),
  
  -- For A/B testing
  compare_prompt_version TEXT,
  
  -- Results
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed')),
  total_examples INTEGER,
  passed INTEGER,
  failed INTEGER,
  score NUMERIC(5,4), -- 0.0000 to 1.0000
  
  -- Detailed results
  results JSONB,
  
  -- Timing
  started_at TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER
);

-- Individual eval results (one per example)
CREATE TABLE IF NOT EXISTS eval_result (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES eval_run(id) ON DELETE CASCADE,
  
  -- Input/output
  input JSONB NOT NULL,
  expected_output JSONB,
  actual_output JSONB,
  
  -- Scoring
  passed BOOLEAN,
  score NUMERIC(5,4),
  
  -- For LLM-as-judge
  judge_reasoning TEXT,
  judge_model TEXT,
  
  -- For A/B testing
  output_a JSONB,
  output_b JSONB,
  winner TEXT CHECK (winner IN ('a', 'b', 'tie')),
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_eval_golden_agent ON eval_golden_set(agent_name);
CREATE INDEX IF NOT EXISTS idx_eval_run_agent ON eval_run(agent_name);
CREATE INDEX IF NOT EXISTS idx_eval_result_run ON eval_result(run_id);

-- Enable RLS
ALTER TABLE eval_golden_set ENABLE ROW LEVEL SECURITY;
ALTER TABLE eval_run ENABLE ROW LEVEL SECURITY;
ALTER TABLE eval_result ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role full access on eval_golden_set" ON eval_golden_set
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on eval_run" ON eval_run
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on eval_result" ON eval_result
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE eval_golden_set IS 'Human-verified test cases for agent evaluation';
COMMENT ON TABLE eval_run IS 'Individual evaluation runs with aggregate results';
COMMENT ON TABLE eval_result IS 'Per-example results within an eval run';
