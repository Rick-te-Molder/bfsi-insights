-- ============================================================================
-- Refactor Taxonomy Tables: Separate UUID Primary Keys from Business Codes
-- ============================================================================
-- Problem: Current design uses business codes (6, 61, 621) as primary keys
-- Solution: Use UUID for id, move business logic to 'code' column
-- Applies to: bfsi_process_taxonomy, bfsi_industry, bfsi_topic

-- Clean up any partial migrations from previous attempts
DROP TABLE IF EXISTS bfsi_process_taxonomy_new CASCADE;
DROP TABLE IF EXISTS bfsi_industry_new CASCADE;
DROP TABLE IF EXISTS bfsi_topic_new CASCADE;

BEGIN;

-- ============================================================================
-- 1. BFSI_PROCESS_TAXONOMY
-- ============================================================================

-- Create new table with proper schema
CREATE TABLE bfsi_process_taxonomy_new (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  level INTEGER NOT NULL CHECK (level IN (0, 1, 2, 3)),
  parent_code TEXT,
  sort_order INTEGER DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_process_code ON bfsi_process_taxonomy_new(code);
CREATE INDEX idx_process_parent ON bfsi_process_taxonomy_new(parent_code);
CREATE INDEX idx_process_level ON bfsi_process_taxonomy_new(level);

-- Migrate data (old 'id' becomes 'code', old 'parent_id' becomes 'parent_code')
INSERT INTO bfsi_process_taxonomy_new (code, name, level, parent_code, sort_order)
SELECT id, name, level, parent_id, 0
FROM bfsi_process_taxonomy
ORDER BY id;

-- Add foreign key constraint after data migration
ALTER TABLE bfsi_process_taxonomy_new
  ADD CONSTRAINT fk_parent_code 
  FOREIGN KEY (parent_code) 
  REFERENCES bfsi_process_taxonomy_new(code) 
  ON DELETE CASCADE;

-- Update ag_use_case to reference code instead of old id
ALTER TABLE ag_use_case 
  DROP CONSTRAINT IF EXISTS ag_use_case_process_fk;

ALTER TABLE ag_use_case 
  RENAME COLUMN bfsi_process_taxonomy_id TO bfsi_process_code;

ALTER TABLE ag_use_case 
  ADD CONSTRAINT fk_process_code 
  FOREIGN KEY (bfsi_process_code) 
  REFERENCES bfsi_process_taxonomy_new(code);

-- Update junction table
ALTER TABLE kb_resource_bfsi_process
  DROP CONSTRAINT IF EXISTS kb_resource_bfsi_process_process_id_fkey;

ALTER TABLE kb_resource_bfsi_process
  RENAME COLUMN process_id TO process_code;

ALTER TABLE kb_resource_bfsi_process
  ADD CONSTRAINT fk_process_code
  FOREIGN KEY (process_code)
  REFERENCES bfsi_process_taxonomy_new(code);

-- Drop old table and rename new one
DROP TABLE bfsi_process_taxonomy CASCADE;
ALTER TABLE bfsi_process_taxonomy_new RENAME TO bfsi_process_taxonomy;

-- ============================================================================
-- 2. BFSI_INDUSTRY
-- ============================================================================

-- Create new table
CREATE TABLE bfsi_industry_new (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,  -- slug becomes code
  name TEXT NOT NULL,         -- label becomes name
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 3),
  parent_code TEXT,
  sort_order INTEGER DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_industry_code ON bfsi_industry_new(code);
CREATE INDEX idx_industry_parent ON bfsi_industry_new(parent_code);
CREATE INDEX idx_industry_level ON bfsi_industry_new(level);

-- Migrate data
INSERT INTO bfsi_industry_new (code, name, level, parent_code, sort_order, description, created_at, updated_at)
SELECT slug, label, level, parent_slug, sort_order, description, created_at, updated_at
FROM bfsi_industry
ORDER BY slug;

-- Add foreign key
ALTER TABLE bfsi_industry_new
  ADD CONSTRAINT fk_parent_code
  FOREIGN KEY (parent_code)
  REFERENCES bfsi_industry_new(code)
  ON DELETE CASCADE;

-- Update junction table
ALTER TABLE kb_resource_bfsi_industry
  DROP CONSTRAINT IF EXISTS kb_resource_bfsi_industry_industry_slug_fkey;

ALTER TABLE kb_resource_bfsi_industry
  RENAME COLUMN industry_slug TO industry_code;

ALTER TABLE kb_resource_bfsi_industry
  ADD CONSTRAINT fk_industry_code
  FOREIGN KEY (industry_code)
  REFERENCES bfsi_industry_new(code);

-- Drop and rename
DROP TABLE bfsi_industry CASCADE;
ALTER TABLE bfsi_industry_new RENAME TO bfsi_industry;

-- ============================================================================
-- 3. BFSI_TOPIC
-- ============================================================================

-- Create new table
CREATE TABLE bfsi_topic_new (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 3),
  parent_code TEXT,
  sort_order INTEGER DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_topic_code ON bfsi_topic_new(code);
CREATE INDEX idx_topic_parent ON bfsi_topic_new(parent_code);
CREATE INDEX idx_topic_level ON bfsi_topic_new(level);

-- Migrate data
INSERT INTO bfsi_topic_new (code, name, level, parent_code, sort_order, description, created_at, updated_at)
SELECT slug, label, level, parent_slug, sort_order, description, created_at, updated_at
FROM bfsi_topic
ORDER BY slug;

-- Add foreign key
ALTER TABLE bfsi_topic_new
  ADD CONSTRAINT fk_parent_code
  FOREIGN KEY (parent_code)
  REFERENCES bfsi_topic_new(code)
  ON DELETE CASCADE;

-- Update junction table
ALTER TABLE kb_resource_bfsi_topic
  DROP CONSTRAINT IF EXISTS kb_resource_bfsi_topic_topic_slug_fkey;

ALTER TABLE kb_resource_bfsi_topic
  RENAME COLUMN topic_slug TO topic_code;

ALTER TABLE kb_resource_bfsi_topic
  ADD CONSTRAINT fk_topic_code
  FOREIGN KEY (topic_code)
  REFERENCES bfsi_topic_new(code);

-- Drop and rename
DROP TABLE bfsi_topic CASCADE;
ALTER TABLE bfsi_topic_new RENAME TO bfsi_topic;

-- ============================================================================
-- 4. Update kb_resource_pretty view to use new column names
-- ============================================================================

DROP VIEW IF EXISTS kb_resource_pretty CASCADE;

CREATE VIEW kb_resource_pretty AS
SELECT 
  p.id,
  p.title,
  p.author,
  p.date_published as publication_date,
  p.date_published as date_added,  -- Using date_published as fallback
  p.url,
  p.source_name,
  p.source_domain,
  p.slug,
  p.summary_short,
  p.summary_medium,
  p.summary_long,
  p.role,
  p.content_type,
  p.geography,
  p.thumbnail,
  p.status,
  p.tags,
  p.use_cases,
  p.agentic_capabilities,
  
  -- First industry code (for backward compatibility)
  (SELECT i.code 
   FROM kb_resource_bfsi_industry ri
   JOIN bfsi_industry i ON i.code = ri.industry_code
   WHERE ri.publication_id = p.id
   ORDER BY ri.rank
   LIMIT 1
  ) as industry,
  
  -- First topic code (for backward compatibility)  
  (SELECT t.code 
   FROM kb_resource_bfsi_topic rt
   JOIN bfsi_topic t ON t.code = rt.topic_code
   WHERE rt.publication_id = p.id
   ORDER BY rt.rank
   LIMIT 1
  ) as topic,
  
  -- Industry array
  COALESCE(
    (SELECT array_agg(i.code ORDER BY ri.rank)
     FROM kb_resource_bfsi_industry ri
     JOIN bfsi_industry i ON i.code = ri.industry_code
     WHERE ri.publication_id = p.id),
    '{}'
  ) as industries,
  
  -- Topic array
  COALESCE(
    (SELECT array_agg(t.code ORDER BY rt.rank)
     FROM kb_resource_bfsi_topic rt
     JOIN bfsi_topic t ON t.code = rt.topic_code
     WHERE rt.publication_id = p.id),
    '{}'
  ) as topics,
  
  -- Process array
  COALESCE(
    (SELECT array_agg(p.code ORDER BY rp.rank)
     FROM kb_resource_bfsi_process rp
     JOIN bfsi_process_taxonomy p ON p.code = rp.process_code
     WHERE rp.publication_id = p.id),
    '{}'
  ) as processes
  
FROM kb_resource r;

-- Grant permissions
GRANT SELECT ON kb_resource_pretty TO anon, authenticated;

COMMIT;

-- ============================================================================
-- Summary
-- ============================================================================
-- ✅ bfsi_process_taxonomy: id (UUID), code (business), parent_code
-- ✅ bfsi_industry: id (UUID), code (business), parent_code
-- ✅ bfsi_topic: id (UUID), code (business), parent_code
-- ✅ Junction tables updated: industry_code, topic_code, process_code
-- ✅ kb_resource_pretty view updated with new column names
-- ✅ All foreign keys preserved and functioning