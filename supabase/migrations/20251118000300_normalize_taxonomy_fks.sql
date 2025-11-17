-- Migration: Normalize taxonomy foreign keys
-- Purpose: Add FK constraints to enforce referential integrity for topic & industry

-- ============================================================================
-- STEP 1: Audit existing data for invalid references
-- ============================================================================

-- Check for invalid topics
DO $$
DECLARE
  invalid_count int;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM kb_resource r
  WHERE r.topic IS NOT NULL 
    AND r.topic != ''
    AND NOT EXISTS (
      SELECT 1 FROM bfsi_topic t WHERE t.slug = r.topic
    );
  
  IF invalid_count > 0 THEN
    RAISE NOTICE 'Found % resources with invalid topic values', invalid_count;
    RAISE NOTICE 'Invalid topics: %', (
      SELECT string_agg(DISTINCT topic, ', ')
      FROM kb_resource r
      WHERE r.topic IS NOT NULL 
        AND r.topic != ''
        AND NOT EXISTS (SELECT 1 FROM bfsi_topic t WHERE t.slug = r.topic)
    );
  END IF;
END $$;

-- Check for invalid industries
DO $$
DECLARE
  invalid_count int;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM kb_resource r
  WHERE r.industry IS NOT NULL 
    AND r.industry != ''
    AND NOT EXISTS (
      SELECT 1 FROM bfsi_industry i WHERE i.slug = r.industry
    );
  
  IF invalid_count > 0 THEN
    RAISE NOTICE 'Found % resources with invalid industry values', invalid_count;
    RAISE NOTICE 'Invalid industries: %', (
      SELECT string_agg(DISTINCT industry, ', ')
      FROM kb_resource r
      WHERE r.industry IS NOT NULL 
        AND r.industry != ''
        AND NOT EXISTS (SELECT 1 FROM bfsi_industry i WHERE i.slug = r.industry)
    );
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Create missing taxonomy entries to preserve data
-- ============================================================================

-- Auto-create missing topic entries from existing resource data
INSERT INTO bfsi_topic (slug, label, level, sort_order, description)
SELECT DISTINCT 
  r.topic as slug,
  INITCAP(REPLACE(r.topic, '-', ' ')) as label,
  1 as level,
  999 as sort_order,
  'Auto-created from existing resource data' as description
FROM kb_resource r
WHERE r.topic IS NOT NULL 
  AND r.topic != ''
  AND NOT EXISTS (SELECT 1 FROM bfsi_topic t WHERE t.slug = r.topic)
ON CONFLICT (slug) DO NOTHING;

-- Auto-create missing industry entries from existing resource data
INSERT INTO bfsi_industry (slug, label, level, sort_order, description)
SELECT DISTINCT
  r.industry as slug,
  INITCAP(REPLACE(r.industry, '-', ' ')) as label,
  1 as level,
  999 as sort_order,
  'Auto-created from existing resource data' as description
FROM kb_resource r
WHERE r.industry IS NOT NULL
  AND r.industry != ''
  AND NOT EXISTS (SELECT 1 FROM bfsi_industry i WHERE i.slug = r.industry)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- STEP 3: Add foreign key constraints
-- ============================================================================

-- Add FK for topic (allows NULL)
ALTER TABLE kb_resource
  ADD CONSTRAINT fk_kb_resource_topic 
  FOREIGN KEY (topic) 
  REFERENCES bfsi_topic(slug)
  ON DELETE SET NULL;

-- Add FK for industry (allows NULL)
ALTER TABLE kb_resource
  ADD CONSTRAINT fk_kb_resource_industry
  FOREIGN KEY (industry)
  REFERENCES bfsi_industry(slug)
  ON DELETE SET NULL;

COMMENT ON CONSTRAINT fk_kb_resource_topic ON kb_resource IS 
  'Enforces referential integrity: topic must exist in bfsi_topic or be NULL';

COMMENT ON CONSTRAINT fk_kb_resource_industry ON kb_resource IS
  'Enforces referential integrity: industry must exist in bfsi_industry or be NULL';

-- ============================================================================
-- STEP 4: Apply same constraints to staging tables
-- ============================================================================

ALTER TABLE kb_resource_stg
  ADD CONSTRAINT fk_kb_resource_stg_topic
  FOREIGN KEY (topic)
  REFERENCES bfsi_topic(slug)
  ON DELETE SET NULL;

ALTER TABLE kb_resource_stg
  ADD CONSTRAINT fk_kb_resource_stg_industry
  FOREIGN KEY (industry)
  REFERENCES bfsi_industry(slug)
  ON DELETE SET NULL;

-- ============================================================================
-- STEP 5: Create indexes for FK lookups and performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_kb_resource_topic ON kb_resource(topic);
CREATE INDEX IF NOT EXISTS idx_kb_resource_industry ON kb_resource(industry);
CREATE INDEX IF NOT EXISTS idx_kb_resource_stg_topic ON kb_resource_stg(topic);
CREATE INDEX IF NOT EXISTS idx_kb_resource_stg_industry ON kb_resource_stg(industry);

COMMENT ON INDEX idx_kb_resource_topic IS 'Speeds up FK lookups and filtering by topic';
COMMENT ON INDEX idx_kb_resource_industry IS 'Speeds up FK lookups and filtering by industry';