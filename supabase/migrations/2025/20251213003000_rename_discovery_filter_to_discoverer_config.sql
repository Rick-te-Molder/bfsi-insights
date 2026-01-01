-- KB-219: Rename discovery-filter prompt key to discoverer-config
--
-- Motivation:
-- - Avoid confusion with screener/scorer (screening stages)
-- - Make it explicit this is config for the discoverer orchestrator
--
-- This migration is safe to run multiple times.
-- It handles both old (prompt_versions) and new (prompt_version) table names.

DO $$
DECLARE
  tbl_name text;
BEGIN
  -- Determine which table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'prompt_version') THEN
    tbl_name := 'prompt_version';
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'prompt_versions') THEN
    tbl_name := 'prompt_versions';
  ELSE
    RAISE NOTICE 'No prompt table found, skipping migration';
    RETURN;
  END IF;

  -- Rename legacy discovery-filter to discoverer-config
  EXECUTE format('UPDATE %I SET agent_name = ''discoverer-config'' WHERE agent_name = ''discovery-filter''', tbl_name);

  -- If discoverer-config doesn't exist at all, create a default config prompt
  EXECUTE format('
    INSERT INTO %I (agent_name, version, prompt_text, is_current, created_at)
    SELECT ''discoverer-config'', ''v1.0'', ''{"min_relevance_score": 0.6, "max_age_days": 30}'', true, now()
    WHERE NOT EXISTS (SELECT 1 FROM %I WHERE agent_name = ''discoverer-config'')
  ', tbl_name, tbl_name);

  -- Ensure exactly one current prompt for discoverer-config
  EXECUTE format('UPDATE %I SET is_current = false WHERE agent_name = ''discoverer-config''', tbl_name);
  
  EXECUTE format('
    WITH latest AS (
      SELECT version FROM %I WHERE agent_name = ''discoverer-config'' ORDER BY created_at DESC LIMIT 1
    )
    UPDATE %I SET is_current = true
    WHERE agent_name = ''discoverer-config'' AND version IN (SELECT version FROM latest)
  ', tbl_name, tbl_name);
END $$;
