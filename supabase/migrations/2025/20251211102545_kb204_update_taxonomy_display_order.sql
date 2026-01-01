-- ============================================================================
-- KB-204: Update taxonomy_config display_order for correct tag ordering
-- ============================================================================
-- New order: audience (handled separately), geography, industry, topic, process,
-- regulator, regulation, organization, vendor
--
-- Audience scoring configs are displayed first by TagDisplay component,
-- so their display_order is less important but kept for consistency.

-- Update non-audience configs to new order
UPDATE taxonomy_config SET display_order = 1 WHERE slug = 'geography';
UPDATE taxonomy_config SET display_order = 2 WHERE slug = 'industry';
UPDATE taxonomy_config SET display_order = 3 WHERE slug = 'topic';
UPDATE taxonomy_config SET display_order = 4 WHERE slug = 'process';
UPDATE taxonomy_config SET display_order = 5 WHERE slug = 'regulator';
UPDATE taxonomy_config SET display_order = 6 WHERE slug = 'regulation';
UPDATE taxonomy_config SET display_order = 7 WHERE slug = 'organization';
UPDATE taxonomy_config SET display_order = 8 WHERE slug = 'vendor';

-- Audience scoring configs (displayed separately, but keep ordered)
UPDATE taxonomy_config SET display_order = 100 WHERE slug = 'audience_executive';
UPDATE taxonomy_config SET display_order = 101 WHERE slug = 'audience_functional_specialist';
UPDATE taxonomy_config SET display_order = 102 WHERE slug = 'audience_engineer';
UPDATE taxonomy_config SET display_order = 103 WHERE slug = 'audience_researcher';
