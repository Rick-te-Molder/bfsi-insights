-- Migration: Declarative Pipeline Schema
-- ASMM Phase 5: Governance & Trust
-- Design doc: docs/architecture/declarative-pipeline-design.md
--
-- This creates the schema for database-driven pipeline configuration.
-- Initially seeded with configs matching current hardcoded behavior.

-- ============================================================
-- PIPELINE DEFINITIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pipeline_definition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.pipeline_definition IS 
  'Defines named pipelines (e.g., full_enrichment, re_enrichment)';

-- ============================================================
-- STEP REGISTRY
-- ============================================================

CREATE TABLE IF NOT EXISTS public.step_registry (
  name text PRIMARY KEY,
  agent_name text NOT NULL,
  description text,
  input_fields text[],
  output_fields text[],
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.step_registry IS 
  'Registry of available step implementations and their contracts';

-- ============================================================
-- PIPELINE STEPS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pipeline_step (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES public.pipeline_definition(id) ON DELETE CASCADE,
  step_name text NOT NULL REFERENCES public.step_registry(name),
  step_order int NOT NULL,
  is_required boolean DEFAULT true,
  timeout_seconds int DEFAULT 300,
  skip_condition jsonb,
  on_success text DEFAULT 'next',
  on_failure text DEFAULT 'abort',
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(pipeline_id, step_order),
  UNIQUE(pipeline_id, step_name)
);

COMMENT ON TABLE public.pipeline_step IS 
  'Individual steps within a pipeline, with conditional logic';

-- ============================================================
-- PIPELINE ENTRY RULES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pipeline_entry_rule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES public.pipeline_definition(id) ON DELETE CASCADE,
  from_status_code smallint REFERENCES public.status_lookup(code),
  trigger_type text NOT NULL,
  priority int DEFAULT 0,
  is_active boolean DEFAULT true,
  
  UNIQUE(from_status_code, trigger_type)
);

COMMENT ON TABLE public.pipeline_entry_rule IS 
  'Rules to select which pipeline based on entry context';

-- ============================================================
-- PIPELINE EXIT RULES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pipeline_exit_rule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES public.pipeline_definition(id) ON DELETE CASCADE,
  from_status_code smallint REFERENCES public.status_lookup(code),
  exit_status_code smallint NOT NULL REFERENCES public.status_lookup(code),
  is_manual boolean DEFAULT false,
  failure_status_code smallint REFERENCES public.status_lookup(code),
  
  UNIQUE(pipeline_id, from_status_code)
);

COMMENT ON TABLE public.pipeline_exit_rule IS 
  'Determines target status based on entry context';

-- ============================================================
-- PIPELINE EXECUTION LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pipeline_execution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id uuid NOT NULL REFERENCES public.ingestion_queue(id),
  pipeline_id uuid NOT NULL REFERENCES public.pipeline_definition(id),
  pipeline_run_id uuid REFERENCES public.pipeline_run(id),
  entry_status_code smallint NOT NULL,
  trigger_type text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  current_step text,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  exit_status_code smallint,
  error_message text,
  step_results jsonb DEFAULT '[]'::jsonb,
  
  CONSTRAINT valid_execution_status CHECK (status IN ('running', 'completed', 'failed', 'aborted'))
);

COMMENT ON TABLE public.pipeline_execution IS 
  'Audit log of pipeline executions with full trace';

CREATE INDEX IF NOT EXISTS idx_pipeline_execution_queue 
  ON public.pipeline_execution(queue_id);

CREATE INDEX IF NOT EXISTS idx_pipeline_execution_status 
  ON public.pipeline_execution(status) WHERE status = 'running';

-- ============================================================
-- SEED DATA: Step Registry
-- ============================================================

INSERT INTO public.step_registry (name, agent_name, description, input_fields, output_fields) VALUES
  ('fetch', 'fetcher', 'Fetch content from URL', ARRAY['url'], ARRAY['textContent', 'title', 'description']),
  ('filter', 'screener', 'Filter irrelevant content', ARRAY['textContent'], ARRAY['rejection_reason']),
  ('summarize', 'summarizer', 'Generate summary and extract entities', ARRAY['textContent'], ARRAY['title', 'summary', 'key_takeaways', 'entities']),
  ('tag', 'tagger', 'Apply taxonomy codes', ARRAY['summary'], ARRAY['industry_codes', 'topic_codes', 'geography_codes', 'audience_scores']),
  ('thumbnail', 'thumbnailer', 'Capture screenshot', ARRAY['url'], ARRAY['thumbnail_url', 'thumbnail_path'])
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- SEED DATA: Full Enrichment Pipeline
-- ============================================================

INSERT INTO public.pipeline_definition (name, description) VALUES
  ('full_enrichment', 'Complete enrichment for newly discovered items')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.pipeline_step (pipeline_id, step_name, step_order, on_failure)
SELECT id, step_name, step_order, on_failure
FROM public.pipeline_definition, (VALUES
  ('fetch', 1, 'retry:3'),
  ('filter', 2, 'abort'),
  ('summarize', 3, 'abort'),
  ('tag', 4, 'abort'),
  ('thumbnail', 5, 'skip')
) AS steps(step_name, step_order, on_failure)
WHERE pipeline_definition.name = 'full_enrichment'
ON CONFLICT (pipeline_id, step_name) DO NOTHING;

INSERT INTO public.pipeline_entry_rule (pipeline_id, from_status_code, trigger_type)
SELECT id, 200, 'discovery'
FROM public.pipeline_definition WHERE name = 'full_enrichment'
ON CONFLICT (from_status_code, trigger_type) DO NOTHING;

INSERT INTO public.pipeline_exit_rule (pipeline_id, from_status_code, exit_status_code, is_manual)
SELECT id, 200, 300, false
FROM public.pipeline_definition WHERE name = 'full_enrichment'
ON CONFLICT (pipeline_id, from_status_code) DO NOTHING;

-- ============================================================
-- SEED DATA: Re-Enrichment Pipeline
-- ============================================================

INSERT INTO public.pipeline_definition (name, description) VALUES
  ('re_enrichment', 'Re-run enrichment on published/review items')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.pipeline_step (pipeline_id, step_name, step_order, on_failure)
SELECT id, step_name, step_order, on_failure
FROM public.pipeline_definition, (VALUES
  ('summarize', 1, 'abort'),
  ('tag', 2, 'abort'),
  ('thumbnail', 3, 'skip')
) AS steps(step_name, step_order, on_failure)
WHERE pipeline_definition.name = 're_enrichment'
ON CONFLICT (pipeline_id, step_name) DO NOTHING;

-- Entry rules for re-enrichment (from review or published)
INSERT INTO public.pipeline_entry_rule (pipeline_id, from_status_code, trigger_type)
SELECT id, status_code, 're-enrich'
FROM public.pipeline_definition, (VALUES (300), (400)) AS statuses(status_code)
WHERE pipeline_definition.name = 're_enrichment'
ON CONFLICT (from_status_code, trigger_type) DO NOTHING;

-- Exit rules: 300→300 (no manual), 400→300 (manual required)
INSERT INTO public.pipeline_exit_rule (pipeline_id, from_status_code, exit_status_code, is_manual)
SELECT id, from_status, 300, is_manual
FROM public.pipeline_definition, (VALUES 
  (300, false),
  (400, true)
) AS rules(from_status, is_manual)
WHERE pipeline_definition.name = 're_enrichment'
ON CONFLICT (pipeline_id, from_status_code) DO NOTHING;

-- ============================================================
-- RLS POLICIES
-- ============================================================

ALTER TABLE public.pipeline_definition ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.step_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_step ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_entry_rule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_exit_rule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_execution ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role full access" ON public.pipeline_definition
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.step_registry
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.pipeline_step
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.pipeline_entry_rule
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.pipeline_exit_rule
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.pipeline_execution
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated users can read definitions (for admin UI)
CREATE POLICY "Authenticated read access" ON public.pipeline_definition
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read access" ON public.step_registry
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read access" ON public.pipeline_step
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read access" ON public.pipeline_entry_rule
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read access" ON public.pipeline_exit_rule
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read access" ON public.pipeline_execution
  FOR SELECT TO authenticated USING (true);
