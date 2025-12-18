-- ============================================================================
-- Migration: Fix bfsi_process_pretty view table reference
-- ============================================================================
-- The previous migration used wrong table name (bfsi_process_taxonomy).
-- The correct table is bfsi_process (consistent with bfsi_industry).
-- ============================================================================

-- Drop the incorrectly created view (may not exist if previous migration failed)
DROP VIEW IF EXISTS bfsi_process_pretty;

-- Create the view with correct table name
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
