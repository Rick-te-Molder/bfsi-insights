-- KB-219: Rename discovery-filter prompt key to discoverer-config
--
-- Motivation:
-- - Avoid confusion with screener/scorer (screening stages)
-- - Make it explicit this is config for the discoverer orchestrator
--
-- This migration is safe to run multiple times.
-- It also enforces a single is_current=true row for the renamed agent.

DO $$
BEGIN
  -- If both names exist, prefer discoverer-config as canonical.
  -- Rename legacy rows to the new agent_name.
  UPDATE prompt_versions
  SET agent_name = 'discoverer-config'
  WHERE agent_name = 'discovery-filter';

  -- Ensure exactly one current prompt for discoverer-config.
  -- 1) Clear current flags
  UPDATE prompt_versions
  SET is_current = false
  WHERE agent_name = 'discoverer-config'
    AND is_current = true;

  -- 2) Set the most recently created version as current (if any rows exist)
  WITH latest AS (
    SELECT version
    FROM prompt_versions
    WHERE agent_name = 'discoverer-config'
    ORDER BY created_at DESC
    LIMIT 1
  )
  UPDATE prompt_versions
  SET is_current = true
  WHERE agent_name = 'discoverer-config'
    AND version IN (SELECT version FROM latest);
END $$;
