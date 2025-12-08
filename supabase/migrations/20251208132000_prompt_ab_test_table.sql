-- KB-182: Prompt A/B Testing Framework
-- Allows comparing two prompt versions with traffic splitting

CREATE TABLE IF NOT EXISTS prompt_ab_test (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Which agent is being tested
  agent_name TEXT NOT NULL,
  
  -- The two variants
  variant_a_version TEXT NOT NULL, -- Control (usually current)
  variant_b_version TEXT NOT NULL, -- Challenger (new prompt)
  
  -- Configuration
  traffic_split NUMERIC(3,2) NOT NULL DEFAULT 0.50, -- 0.50 = 50/50 split
  sample_size INTEGER NOT NULL DEFAULT 100, -- Target number of items
  
  -- Tracking
  items_processed INTEGER DEFAULT 0,
  items_variant_a INTEGER DEFAULT 0,
  items_variant_b INTEGER DEFAULT 0,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'completed', 'cancelled')),
  
  -- Results (populated when completed)
  results JSONB DEFAULT '{}',
  winner TEXT CHECK (winner IN ('a', 'b', 'tie', NULL)),
  
  -- Metadata
  name TEXT, -- Optional friendly name
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT different_variants CHECK (variant_a_version != variant_b_version)
);

-- Track which items were processed by which variant
CREATE TABLE IF NOT EXISTS prompt_ab_test_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL REFERENCES prompt_ab_test(id) ON DELETE CASCADE,
  
  -- Which item was processed
  queue_item_id UUID REFERENCES ingestion_queue(id) ON DELETE SET NULL,
  
  -- Which variant processed it
  variant TEXT NOT NULL CHECK (variant IN ('a', 'b')),
  
  -- Results
  output JSONB,
  
  -- Metrics
  latency_ms INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  confidence NUMERIC(5,4),
  
  -- Quality indicators
  error_count INTEGER DEFAULT 0,
  validation_passed BOOLEAN,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_prompt_ab_test_agent ON prompt_ab_test(agent_name);
CREATE INDEX idx_prompt_ab_test_status ON prompt_ab_test(status);
CREATE INDEX idx_prompt_ab_test_item_test ON prompt_ab_test_item(test_id);
CREATE INDEX idx_prompt_ab_test_item_variant ON prompt_ab_test_item(test_id, variant);

-- RLS
ALTER TABLE prompt_ab_test ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_ab_test_item ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on prompt_ab_test" ON prompt_ab_test
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on prompt_ab_test_item" ON prompt_ab_test_item
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Function to get the variant for a new item (for use during enrichment)
CREATE OR REPLACE FUNCTION get_ab_test_variant(p_agent_name TEXT)
RETURNS TABLE(test_id UUID, variant TEXT, prompt_version TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
  v_test prompt_ab_test;
  v_variant TEXT;
  v_prompt_version TEXT;
BEGIN
  -- Find active test for this agent
  SELECT * INTO v_test
  FROM prompt_ab_test
  WHERE agent_name = p_agent_name
    AND status = 'running'
    AND items_processed < sample_size
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Determine variant based on traffic split
  IF random() < v_test.traffic_split THEN
    v_variant := 'a';
    v_prompt_version := v_test.variant_a_version;
  ELSE
    v_variant := 'b';
    v_prompt_version := v_test.variant_b_version;
  END IF;
  
  RETURN QUERY SELECT v_test.id, v_variant, v_prompt_version;
END;
$$;

COMMENT ON TABLE prompt_ab_test IS 'A/B tests for comparing prompt versions';
COMMENT ON TABLE prompt_ab_test_item IS 'Individual items processed during an A/B test';
COMMENT ON FUNCTION get_ab_test_variant IS 'Returns the test variant to use for a given agent (if test is running)';
