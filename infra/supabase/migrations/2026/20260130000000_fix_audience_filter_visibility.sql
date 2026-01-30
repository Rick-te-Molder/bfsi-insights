-- ============================================================================
-- Fix audience filter visibility on public website
-- ============================================================================
-- Issue: Audience filter missing from publications page and showing 0 counts
-- Root cause: ref_filter_config missing 'audience' entry after role→audience rename
-- ============================================================================

-- Ensure audience filter exists in ref_filter_config
INSERT INTO ref_filter_config (column_name, display_label, filter_type, sort_order, enabled, description)
VALUES ('audience', 'Audience', 'multi-select', 10, true, 'Target audience (Executive, Functional Specialist, Engineer, Researcher)')
ON CONFLICT (column_name) 
DO UPDATE SET
  display_label = EXCLUDED.display_label,
  filter_type = EXCLUDED.filter_type,
  sort_order = EXCLUDED.sort_order,
  enabled = EXCLUDED.enabled,
  description = EXCLUDED.description;

-- Verify the view has audience data
-- (kb_publication_pretty should already have audience and audiences[] from migration 20251214200000)

COMMENT ON COLUMN ref_filter_config.column_name IS 'Column name in kb_publication_pretty view (e.g., audience, industry, geography)';
