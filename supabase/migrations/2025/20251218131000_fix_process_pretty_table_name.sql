-- ============================================================================
-- Migration: Fix bfsi_process_pretty view and tagger v2.2 is_current flag
-- ============================================================================
-- Fixes from previous migration (20251218130000):
-- 1. Wrong table name (bfsi_process_taxonomy → bfsi_process)
-- 2. Wrong is_current flag (DEV stage should NOT be is_current=true)
-- ============================================================================

-- ============================================================================
-- 1. FIX bfsi_process_pretty VIEW
-- ============================================================================
DROP VIEW IF EXISTS bfsi_process_pretty;

CREATE VIEW bfsi_process_pretty
WITH (security_invoker = true)
AS
SELECT 
  l0.code AS l0_code,
  l0.name AS l0_domain,
  l1.code AS l1_code,
  l1.name AS l1_process_group,
  l2.code AS l2_code,
  l2.name AS l2_process,
  l3.code AS l3_code,
  l3.name AS l3_process_step,
  (
    l0.name || 
    COALESCE(' / ' || l1.name, '') || 
    COALESCE(' / ' || l2.name, '') || 
    COALESCE(' / ' || l3.name, '')
  ) AS path
FROM bfsi_process l0
LEFT JOIN bfsi_process l1 ON l1.parent_code = l0.code AND l1.level = 1
LEFT JOIN bfsi_process l2 ON l2.parent_code = l1.code AND l2.level = 2
LEFT JOIN bfsi_process l3 ON l3.parent_code = l2.code AND l3.level = 3
WHERE l0.level = 0;

-- ============================================================================
-- 2. FIX tagger-v2.2 is_current FLAG
-- ============================================================================
-- DEV stage should NOT be is_current=true. The old PRD version should remain current.
-- Set tagger-v2.2 to is_current=false (it's a draft to be promoted)
UPDATE prompt_version 
SET is_current = false 
WHERE agent_name = 'tagger' AND version = 'tagger-v2.2';

-- Restore the previous PRD version as current (find the most recent PRD version)
UPDATE prompt_version 
SET is_current = true 
WHERE agent_name = 'tagger' 
  AND stage = 'PRD'
  AND version != 'tagger-v2.2'
  AND id = (
    SELECT id FROM prompt_version 
    WHERE agent_name = 'tagger' AND stage = 'PRD' AND version != 'tagger-v2.2'
    ORDER BY created_at DESC 
    LIMIT 1
  );
