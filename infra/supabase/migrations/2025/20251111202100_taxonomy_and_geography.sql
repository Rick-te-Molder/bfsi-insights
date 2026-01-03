-- Migration: Add taxonomy tables and rename jurisdiction to geography
-- Purpose: 
--   1. Rename jurisdiction → geography (broader scope)
--   2. Create bfsi_topic_taxonomy from JSON schema
--   3. Seed bfsi_industry with current schema values
--   4. Create filter views showing only used taxonomy items with counts

-- ============================================================================
-- 1. Rename jurisdiction to geography
-- ============================================================================

-- Update kb_resource table
ALTER TABLE kb_resource 
  RENAME COLUMN jurisdiction TO geography;

COMMENT ON COLUMN kb_resource.geography IS 
  'Geographic scope: regulatory jurisdiction OR market focus (e.g., "nl" for Dutch regulations OR Dutch market)';

-- Update ingestion_queue payload
UPDATE ingestion_queue
SET payload = jsonb_set(
  payload - 'tags' || 
  jsonb_build_object('tags', 
    (payload->'tags')::jsonb - 'jurisdiction' || 
    jsonb_build_object('geography', payload->'tags'->'jurisdiction')
  ),
  '{}',
  payload
)
WHERE payload->'tags'->>'jurisdiction' IS NOT NULL;

-- ============================================================================
-- 2. Create bfsi_topic_taxonomy
-- ============================================================================

CREATE TABLE bfsi_topic (
  slug text PRIMARY KEY,
  label text NOT NULL,
  parent_slug text REFERENCES bfsi_topic(slug) ON DELETE CASCADE,
  level int NOT NULL CHECK (level BETWEEN 1 AND 3),
  sort_order int DEFAULT 0,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_bfsi_topic_parent ON bfsi_topic(parent_slug);
CREATE INDEX idx_bfsi_topic_level ON bfsi_topic(level);

COMMENT ON TABLE bfsi_topic IS 
  'Simplified topic taxonomy for filtering. Derived from JSON schema. Grows organically with content.';

-- Seed topic taxonomy (Level 1)
INSERT INTO bfsi_topic (slug, label, level, sort_order) VALUES
  ('strategy-and-management', 'Strategy & Management', 1, 10),
  ('ecosystem', 'Ecosystem', 1, 20),
  ('governance-and-control', 'Governance & Control', 1, 30),
  ('regulatory-and-standards', 'Regulatory & Standards', 1, 40),
  ('technology-and-data', 'Technology & Data', 1, 50),
  ('methods-and-approaches', 'Methods & Approaches', 1, 60);

-- Seed topic taxonomy (Level 2 - most common)
INSERT INTO bfsi_topic (slug, label, parent_slug, level, sort_order) VALUES
  ('technology-and-data-ai', 'AI', 'technology-and-data', 2, 51),
  ('technology-and-data-agentic-engineering', 'Agentic Engineering', 'technology-and-data', 2, 52),
  ('technology-and-data-rag', 'RAG', 'technology-and-data', 2, 53),
  ('governance-and-control-risk-management', 'Risk Management', 'governance-and-control', 2, 31),
  ('governance-and-control-compliance', 'Compliance', 'governance-and-control', 2, 32),
  ('governance-and-control-financial-crime-prevention', 'Financial Crime Prevention', 'governance-and-control', 2, 33);

-- ============================================================================
-- 3. Seed bfsi_industry with current values
-- ============================================================================

-- Ensure table exists (should already from previous work)
CREATE TABLE IF NOT EXISTS bfsi_industry (
  slug text PRIMARY KEY,
  label text NOT NULL,
  parent_slug text REFERENCES bfsi_industry(slug) ON DELETE CASCADE,
  level int NOT NULL CHECK (level BETWEEN 1 AND 3),
  sort_order int DEFAULT 0,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bfsi_industry_parent ON bfsi_industry(parent_slug);
CREATE INDEX IF NOT EXISTS idx_bfsi_industry_level ON bfsi_industry(level);

-- Clear and reseed
TRUNCATE bfsi_industry CASCADE;

-- Level 1
INSERT INTO bfsi_industry (slug, label, level, sort_order) VALUES
  ('banking', 'Banking', 1, 10),
  ('financial-services', 'Financial Services', 1, 20),
  ('insurance', 'Insurance', 1, 30),
  ('cross-bfsi', 'Cross-BFSI', 1, 40);

-- Level 2 - Banking
INSERT INTO bfsi_industry (slug, label, parent_slug, level, sort_order) VALUES
  ('banking-retail-banking', 'Retail Banking', 'banking', 2, 11),
  ('banking-corporate-banking', 'Corporate Banking', 'banking', 2, 12),
  ('banking-lending', 'Lending', 'banking', 2, 13),
  ('banking-payments', 'Payments', 'banking', 2, 14),
  ('banking-deposits', 'Deposits', 'banking', 2, 15),
  ('banking-treasury', 'Treasury', 'banking', 2, 16),
  ('banking-capital-markets', 'Capital Markets', 'banking', 2, 17),
  ('banking-digital-banking', 'Digital Banking', 'banking', 2, 18);

-- Level 2 - Financial Services
INSERT INTO bfsi_industry (slug, label, parent_slug, level, sort_order) VALUES
  ('financial-services-financial-advice', 'Financial Advice', 'financial-services', 2, 21),
  ('financial-services-wealth-management', 'Wealth Management', 'financial-services', 2, 22),
  ('financial-services-asset-management', 'Asset Management', 'financial-services', 2, 23),
  ('financial-services-leasing', 'Leasing', 'financial-services', 2, 24),
  ('financial-services-factoring', 'Factoring', 'financial-services', 2, 25),
  ('financial-services-pension-funds', 'Pension Funds', 'financial-services', 2, 26),
  ('financial-services-insurance-brokerage', 'Insurance Brokerage', 'financial-services', 2, 27);

-- Level 2 - Insurance
INSERT INTO bfsi_industry (slug, label, parent_slug, level, sort_order) VALUES
  ('insurance-health-insurance', 'Health Insurance', 'insurance', 2, 31),
  ('insurance-life-insurance', 'Life Insurance', 'insurance', 2, 32),
  ('insurance-pension-insurance', 'Pension Insurance', 'insurance', 2, 33),
  ('insurance-property-and-casualty', 'Property & Casualty', 'insurance', 2, 34);

-- Level 2 - Cross-BFSI
INSERT INTO bfsi_industry (slug, label, parent_slug, level, sort_order) VALUES
  ('cross-bfsi-infrastructure', 'Infrastructure', 'cross-bfsi', 2, 41),
  ('cross-bfsi-shared-services', 'Shared Services', 'cross-bfsi', 2, 42),
  ('cross-bfsi-b2b-platforms', 'B2B Platforms', 'cross-bfsi', 2, 43);

-- ============================================================================
-- 4. Create filter views (only show used items with counts)
-- ============================================================================

-- Industry filter view
CREATE OR REPLACE VIEW bfsi_industry_filter AS
WITH RECURSIVE industry_tree AS (
  -- Get all industries that have resources
  SELECT DISTINCT 
    i.slug,
    i.label,
    i.parent_slug,
    i.level,
    i.sort_order,
    COUNT(p.id) as direct_count
  FROM bfsi_industry i
  LEFT JOIN kb_resource r ON r.industry = i.slug
  GROUP BY i.slug, i.label, i.parent_slug, i.level, i.sort_order
  
  UNION
  
  -- Include parents of used industries
  SELECT DISTINCT
    p.slug,
    p.label,
    p.parent_slug,
    p.level,
    p.sort_order,
    0 as direct_count
  FROM bfsi_industry p
  INNER JOIN industry_tree c ON c.parent_slug = p.slug
)
SELECT 
  slug,
  label,
  parent_slug,
  level,
  sort_order,
  (SELECT COUNT(*) FROM kb_resource WHERE industry = industry_tree.slug) as count,
  (SELECT COUNT(*) FROM kb_resource r2 
   INNER JOIN bfsi_industry i2 ON r2.industry = i2.slug
   WHERE i2.slug LIKE industry_tree.slug || '%') as total_count
FROM industry_tree
WHERE direct_count > 0 OR EXISTS (
  SELECT 1 FROM industry_tree child WHERE child.parent_slug = industry_tree.slug
)
ORDER BY sort_order;

COMMENT ON VIEW bfsi_industry_filter IS 
  'Filter view: shows only industry taxonomy items that have content (or have children with content), with counts';

-- Topic filter view
CREATE OR REPLACE VIEW bfsi_topic_filter AS
WITH RECURSIVE topic_tree AS (
  SELECT DISTINCT 
    t.slug,
    t.label,
    t.parent_slug,
    t.level,
    t.sort_order,
    COUNT(p.id) as direct_count
  FROM bfsi_topic t
  LEFT JOIN kb_resource r ON r.topic = t.slug
  GROUP BY t.slug, t.label, t.parent_slug, t.level, t.sort_order
  
  UNION
  
  SELECT DISTINCT
    p.slug,
    p.label,
    p.parent_slug,
    p.level,
    p.sort_order,
    0 as direct_count
  FROM bfsi_topic p
  INNER JOIN topic_tree c ON c.parent_slug = p.slug
)
SELECT 
  slug,
  label,
  parent_slug,
  level,
  sort_order,
  (SELECT COUNT(*) FROM kb_resource WHERE topic = topic_tree.slug) as count,
  (SELECT COUNT(*) FROM kb_resource r2 
   INNER JOIN bfsi_topic t2 ON r2.topic = t2.slug
   WHERE t2.slug LIKE topic_tree.slug || '%') as total_count
FROM topic_tree
WHERE direct_count > 0 OR EXISTS (
  SELECT 1 FROM topic_tree child WHERE child.parent_slug = topic_tree.slug
)
ORDER BY sort_order;

COMMENT ON VIEW bfsi_topic_filter IS 
  'Filter view: shows only topic taxonomy items that have content (or have children with content), with counts';

-- Grant permissions
GRANT SELECT ON bfsi_industry_filter TO anon, authenticated;
GRANT SELECT ON bfsi_topic_filter TO anon, authenticated;
GRANT SELECT ON bfsi_industry TO anon, authenticated;
GRANT SELECT ON bfsi_topic TO anon, authenticated;

