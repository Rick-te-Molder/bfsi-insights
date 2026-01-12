-- Migration: Convert kb_publication to UUID primary key
-- Run date: 2024-11-24
-- Purpose: Fix schema inconsistency - all tables should use UUID

-- ============================================================================
-- PART 1: Backup and analyze current state
-- ============================================================================

-- First, let's check what we're working with
DO $$
BEGIN
  RAISE NOTICE 'Current kb_publication.id type: %', 
    (SELECT data_type FROM information_schema.columns 
     WHERE table_name = 'kb_publication' AND column_name = 'id');
END $$;

-- ============================================================================
-- PART 2: Create new UUID-based table structure
-- ============================================================================

-- Drop and recreate kb_publication with UUID primary key
ALTER TABLE IF EXISTS kb_publication RENAME TO kb_publication_old;

CREATE TABLE kb_publication (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  author text,
  date_published timestamptz,
  date_added timestamptz DEFAULT now(),
  last_edited timestamptz DEFAULT now(),
  
  source_url text NOT NULL,
  source_name text,
  source_domain text,
  
  thumbnail text,
  summary_short text,
  summary_medium text,
  summary_long text,
  
  role text,
  content_type text,
  geography text,
  
  use_cases text,
  agentic_capabilities text,
  
  status text DEFAULT 'draft' CHECK (status IN ('published', 'draft', 'archived')),
  origin_queue_id uuid REFERENCES ingestion_queue(id)
);

-- Create indexes
CREATE INDEX idx_kb_publication_status ON kb_publication(status);
CREATE INDEX idx_kb_publication_date_added ON kb_publication(date_added DESC);
CREATE INDEX idx_kb_publication_source_url ON kb_publication(source_url);

-- ============================================================================
-- PART 3: Migrate existing data
-- ============================================================================

INSERT INTO kb_publication (
  id, slug, title, author, date_published, date_added, last_edited,
  source_url, source_name, source_domain,
  thumbnail, summary_short, summary_medium, summary_long,
  role, content_type, geography,
  use_cases, agentic_capabilities, status, origin_queue_id
)
SELECT 
  gen_random_uuid(), -- Generate new UUIDs
  slug, title, author, date_published, date_added, last_edited,
  source_url, source_name, source_domain,
  thumbnail, summary_short, summary_medium, summary_long,
  role, content_type, geography,
  use_cases, agentic_capabilities, status, origin_queue_id
FROM kb_publication_old;

-- ============================================================================
-- PART 4: Update junction tables to use UUID
-- ============================================================================

-- Note: Junction tables will lose their links during migration
-- This is acceptable since we're re-establishing the schema properly

DROP TABLE IF EXISTS kb_publication_bfsi_industry CASCADE;
DROP TABLE IF EXISTS kb_publication_bfsi_topic CASCADE;
DROP TABLE IF EXISTS kb_publication_ag_vendor CASCADE;
DROP TABLE IF EXISTS kb_publication_bfsi_organization CASCADE;

-- Create fresh junction tables with UUID foreign keys
CREATE TABLE kb_publication_bfsi_industry (
  publication_id uuid REFERENCES kb_publication(id) ON DELETE CASCADE,
  industry_code text NOT NULL,
  rank integer DEFAULT 0,
  PRIMARY KEY (publication_id, industry_code)
);

CREATE TABLE kb_publication_bfsi_topic (
  publication_id uuid REFERENCES kb_publication(id) ON DELETE CASCADE,
  topic_code text NOT NULL,
  rank integer DEFAULT 0,
  PRIMARY KEY (publication_id, topic_code)
);

CREATE TABLE kb_publication_ag_vendor (
  publication_id uuid REFERENCES kb_publication(id) ON DELETE CASCADE,
  vendor_id integer REFERENCES ag_vendor(id) ON DELETE CASCADE,
  rank integer DEFAULT 0,
  PRIMARY KEY (publication_id, vendor_id)
);

CREATE TABLE kb_publication_bfsi_organization (
  publication_id uuid REFERENCES kb_publication(id) ON DELETE CASCADE,
  organization_id integer REFERENCES bfsi_organization(id) ON DELETE CASCADE,
  rank integer DEFAULT 0,
  PRIMARY KEY (publication_id, organization_id)
);

-- ============================================================================
-- PART 5: Clean up and verify
-- ============================================================================

-- Drop old table
DROP TABLE IF EXISTS kb_publication_old CASCADE;

-- Verify migration
DO $$
DECLARE
  old_count integer;
  new_count integer;
BEGIN
  SELECT COUNT(*) INTO old_count FROM kb_publication;
  RAISE NOTICE 'Migrated % publications to UUID-based table', old_count;
  
  -- Check ID type
  RAISE NOTICE 'New kb_publication.id type: %', 
    (SELECT data_type FROM information_schema.columns 
     WHERE table_name = 'kb_publication' AND column_name = 'id');
END $$;

-- Add helpful comments
COMMENT ON TABLE kb_publication IS 'Published BFSI content with UUID primary keys';
COMMENT ON COLUMN kb_publication.id IS 'UUID primary key for distributed systems';