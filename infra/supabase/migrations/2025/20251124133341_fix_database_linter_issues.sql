-- Migration: Fix database linter issues
-- Run date: 2024-11-24
-- Purpose: Address security, performance, and RLS issues flagged by Supabase linter

-- ============================================================================
-- PART 1: CRITICAL - Fix Security Definer View
-- ============================================================================

-- Drop and recreate kb_publication_pretty without SECURITY DEFINER
DROP VIEW IF EXISTS kb_publication_pretty CASCADE;

CREATE OR REPLACE VIEW kb_publication_pretty AS
SELECT 
  p.id,
  p.slug,
  p.title,
  p.author as authors,
  p.date_published,
  p.date_added,
  p.last_edited,
  p.source_url as url,
  p.source_name,
  p.source_domain,
  p.thumbnail,
  p.summary_short,
  p.summary_medium,
  p.summary_long,
  p.role,
  p.content_type,
  p.geography,
  p.use_cases,
  p.agentic_capabilities,
  p.status,
  COALESCE(
    ARRAY_AGG(DISTINCT pbi.industry_code) FILTER (WHERE pbi.industry_code IS NOT NULL),
    ARRAY[]::text[]
  ) as industries,
  COALESCE(
    ARRAY_AGG(DISTINCT pbt.topic_code) FILTER (WHERE pbt.topic_code IS NOT NULL),
    ARRAY[]::text[]
  ) as topics
FROM kb_publication p
LEFT JOIN kb_publication_bfsi_industry pbi ON p.id = pbi.publication_id
LEFT JOIN kb_publication_bfsi_topic pbt ON p.id = pbt.publication_id
GROUP BY p.id;

GRANT SELECT ON kb_publication_pretty TO anon, authenticated;

-- ============================================================================
-- PART 2: CRITICAL - Enable RLS on Publication Tables
-- ============================================================================

-- Enable RLS on kb_publication
ALTER TABLE kb_publication ENABLE ROW LEVEL SECURITY;

-- Public read access to published items
CREATE POLICY "Public read access to published publications"
ON kb_publication FOR SELECT TO public
USING (status = 'published');

-- Service role full access
CREATE POLICY "Service role full access to publications"
ON kb_publication FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Enable RLS on junction tables
ALTER TABLE kb_publication_bfsi_industry ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_publication_bfsi_topic ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_publication_ag_vendor ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_publication_bfsi_organization ENABLE ROW LEVEL SECURITY;

-- Public read access to junction tables
CREATE POLICY "Public read junction industries" ON kb_publication_bfsi_industry FOR SELECT TO public USING (true);
CREATE POLICY "Public read junction topics" ON kb_publication_bfsi_topic FOR SELECT TO public USING (true);
CREATE POLICY "Public read junction vendors" ON kb_publication_ag_vendor FOR SELECT TO public USING (true);
CREATE POLICY "Public read junction orgs" ON kb_publication_bfsi_organization FOR SELECT TO public USING (true);

-- Service role full access
CREATE POLICY "Service junction industries" ON kb_publication_bfsi_industry FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service junction topics" ON kb_publication_bfsi_topic FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service junction vendors" ON kb_publication_ag_vendor FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service junction orgs" ON kb_publication_bfsi_organization FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- PART 3: Fix duplicate policies on ingestion_queue
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users full access" ON ingestion_queue;

-- ============================================================================
-- PART 4: Add policy to kb_geography
-- ============================================================================

CREATE POLICY "Public read geography" ON kb_geography FOR SELECT TO public USING (true);

-- ============================================================================
-- PART 5: Add missing indexes on foreign keys
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_kb_publication_origin_queue_id ON kb_publication(origin_queue_id);
CREATE INDEX IF NOT EXISTS idx_kb_publication_ag_vendor_vendor_id ON kb_publication_ag_vendor(vendor_id);
CREATE INDEX IF NOT EXISTS idx_kb_publication_bfsi_org_id ON kb_publication_bfsi_organization(organization_id);

-- ============================================================================
-- PART 6: Add primary key to kb_publication_bfsi_process
-- ============================================================================

ALTER TABLE kb_publication_bfsi_process ADD PRIMARY KEY (publication_id, process_code);
