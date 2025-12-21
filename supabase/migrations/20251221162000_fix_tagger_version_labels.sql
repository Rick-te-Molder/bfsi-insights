-- ============================================================================
-- Migration: Fix tagger version labels
-- ============================================================================
-- Issue: v2.7 labeled as "Test" but should be "RET" (was in PRD, now retired)
--        v2.4 shows as "v.2.4" instead of "tagger-v2.4"
-- ============================================================================

-- Fix v2.7 stage: TST → RET (retired, was in PRD)
UPDATE prompt_version
SET stage = 'RET'
WHERE agent_name = 'tagger' 
  AND version = 'tagger-v2.7';

-- Fix v2.4 version name if it exists with wrong format
UPDATE prompt_version
SET version = 'tagger-v2.4'
WHERE agent_name = 'tagger' 
  AND (version = 'v.2.4' OR version LIKE 'v.2.4%' OR version LIKE '%2.4%')
  AND version != 'tagger-v2.4';
