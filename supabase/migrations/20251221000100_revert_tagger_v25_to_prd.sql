-- ============================================================================
-- Migration: Revert tagger v2.5 back to PRD
-- ============================================================================
-- Root cause: Previous migration (20251221000000) incorrectly retired v2.5
-- before v2.6 was ready, leaving no active tagger prompt.
-- Solution: Restore v2.5 to PRD so tagger works while v2.6 is being tested.
-- ============================================================================

-- Restore v2.5 to PRD
UPDATE prompt_version
SET stage = 'PRD', retired_at = NULL
WHERE agent_name = 'tagger' AND version = 'tagger-v2.5';

-- Keep v2.6 as DEV for testing
-- (no changes needed, already in DEV)
