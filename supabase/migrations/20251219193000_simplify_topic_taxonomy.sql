-- ============================================================================
-- Migration: Simplify topic taxonomy
-- ============================================================================
-- Change topic codes and names to shorter versions:
-- - technology-and-data → technology
-- - strategy-and-management → strategy
-- - regulatory-and-standards → regulatory
-- - methods-and-approaches → methods
-- - ecosystem → agentic
-- ============================================================================

-- 1. Update existing topic codes in bfsi_topic table
UPDATE bfsi_topic SET code = 'technology', name = 'Technology' WHERE code = 'technology-and-data';
UPDATE bfsi_topic SET code = 'strategy', name = 'Strategy' WHERE code = 'strategy-and-management';
UPDATE bfsi_topic SET code = 'regulatory', name = 'Regulatory' WHERE code = 'regulatory-and-standards';
UPDATE bfsi_topic SET code = 'methods', name = 'Methods' WHERE code = 'methods-and-approaches';
UPDATE bfsi_topic SET code = 'agentic', name = 'Agentic' WHERE code = 'ecosystem';

-- 2. Migrate existing publication topic associations
UPDATE kb_publication_bfsi_topic SET topic_code = 'technology' WHERE topic_code = 'technology-and-data';
UPDATE kb_publication_bfsi_topic SET topic_code = 'strategy' WHERE topic_code = 'strategy-and-management';
UPDATE kb_publication_bfsi_topic SET topic_code = 'regulatory' WHERE topic_code = 'regulatory-and-standards';
UPDATE kb_publication_bfsi_topic SET topic_code = 'methods' WHERE topic_code = 'methods-and-approaches';
UPDATE kb_publication_bfsi_topic SET topic_code = 'agentic' WHERE topic_code = 'ecosystem';

-- 3. Verify migration
SELECT 
  bt.code,
  bt.name,
  bt.sort_order,
  COUNT(pbt.publication_id) as publication_count
FROM bfsi_topic bt
LEFT JOIN kb_publication_bfsi_topic pbt ON bt.code = pbt.topic_code
GROUP BY bt.code, bt.name, bt.sort_order
ORDER BY bt.sort_order;
