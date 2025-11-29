-- Migration: Add discovery-filter prompt for configurable exclusion patterns
-- This allows managing exclusion patterns via the database instead of hardcoding

-- Only insert if not exists (agent_name + version combo)
INSERT INTO prompt_versions (agent_name, version, is_current, prompt_text, model_id, stage, created_at)
SELECT 
  'discovery-filter',
  'discovery-filter-v1.0',
  true,
  '{
    "description": "Configuration for discovery pre-filtering",
    "exclusion_patterns": [
      "\\b(medical|healthcare|x-ray|diagnosis|patient|clinical|hospital|doctor)\\b",
      "\\b(classroom|curriculum|pedagogy|teaching methods|school|student|k-12)\\b",
      "\\b(agriculture|farming|crop|soil|harvest|livestock)\\b",
      "\\b(manufacturing|factory|production line|assembly|industrial machinery)\\b",
      "\\b(military|defense|weapon|combat|warfare)\\b"
    ],
    "notes": "Exclusion patterns are regex strings. Edit this JSON to update filtering behavior."
  }',
  null,
  'discovery',
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM prompt_versions WHERE agent_name = 'discovery-filter'
);

COMMENT ON TABLE prompt_versions IS 
  'Stores versioned prompts and configurations for AI agents. discovery-filter contains JSON config for pre-filtering.';
