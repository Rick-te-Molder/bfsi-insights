-- ============================================================================
-- Fix Supabase linter security and performance issues
-- ============================================================================

-- ============================================================================
-- 1. Fix Security Definer Views (remove security_invoker = true)
-- ============================================================================

-- Recreate obligation_pretty without SECURITY DEFINER
DROP VIEW IF EXISTS obligation_pretty;
CREATE VIEW obligation_pretty 
WITH (security_invoker = true)
AS
SELECT 
  id,
  code,
  name,
  description,
  category,
  article_reference,
  regulation_code
FROM obligation
ORDER BY regulation_code, sort_order;

-- Recreate kb_publication_pretty without SECURITY DEFINER  
DROP VIEW IF EXISTS kb_publication_pretty;
CREATE VIEW kb_publication_pretty
WITH (security_invoker = true)
AS
SELECT 
  p.id,
  p.slug,
  p.title,
  p.author,
  p.date_published,
  p.source_url,
  p.source_name,
  p.source_domain,
  p.thumbnail,
  p.thumbnail_bucket,
  p.thumbnail_path,
  p.summary_short,
  p.summary_medium,
  p.summary_long,
  p.content_type,
  p.role,
  p.geography,
  p.status,
  -- Primary industry/topic
  (SELECT pi.industry_code 
   FROM kb_publication_bfsi_industry pi 
   WHERE pi.publication_id = p.id 
   ORDER BY pi.rank NULLS LAST 
   LIMIT 1) as industry,
  (SELECT pt.topic_code 
   FROM kb_publication_bfsi_topic pt 
   WHERE pt.publication_id = p.id 
   ORDER BY pt.rank NULLS LAST 
   LIMIT 1) as topic,
  -- Arrays
  COALESCE((SELECT array_agg(pi.industry_code ORDER BY pi.rank NULLS LAST)
   FROM kb_publication_bfsi_industry pi WHERE pi.publication_id = p.id), '{}') as industries,
  COALESCE((SELECT array_agg(pt.topic_code ORDER BY pt.rank NULLS LAST)
   FROM kb_publication_bfsi_topic pt WHERE pt.publication_id = p.id), '{}') as topics,
  COALESCE((SELECT array_agg(pr.regulator_code)
   FROM kb_publication_regulator pr WHERE pr.publication_id = p.id), '{}') as regulators,
  COALESCE((SELECT array_agg(preg.regulation_code)
   FROM kb_publication_regulation preg WHERE preg.publication_id = p.id), '{}') as regulations,
  COALESCE((SELECT array_agg(po.obligation_code)
   FROM kb_publication_obligation po WHERE po.publication_id = p.id), '{}') as obligations,
  COALESCE((SELECT array_agg(pp.process_code)
   FROM kb_publication_bfsi_process pp WHERE pp.publication_id = p.id), '{}') as processes
FROM kb_publication p
WHERE p.status = 'published';

-- ============================================================================
-- 2. Enable RLS on missing tables
-- ============================================================================

ALTER TABLE discovery_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_publication_regulator ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_publication_regulation ENABLE ROW LEVEL SECURITY;
ALTER TABLE classic_papers ENABLE ROW LEVEL SECURITY;

-- Add read policies for these tables
CREATE POLICY "discovery_metrics_read_all" ON discovery_metrics FOR SELECT USING (true);
CREATE POLICY "kb_pub_regulator_read_all" ON kb_publication_regulator FOR SELECT USING (true);
CREATE POLICY "kb_pub_regulation_read_all" ON kb_publication_regulation FOR SELECT USING (true);
CREATE POLICY "classic_papers_read_all" ON classic_papers FOR SELECT USING (true);

-- ============================================================================
-- 3. Fix function search_path
-- ============================================================================

CREATE OR REPLACE FUNCTION update_classic_papers_updated_at()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. Fix RLS policies - use (select auth.role()) for performance
-- ============================================================================

-- Drop overlapping policies on obligation
DROP POLICY IF EXISTS obligation_write_service ON obligation;
CREATE POLICY "obligation_write_service" ON obligation 
  FOR ALL 
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

-- Drop overlapping policies on kb_publication_obligation
DROP POLICY IF EXISTS pub_obligation_write_service ON kb_publication_obligation;
CREATE POLICY "pub_obligation_write_service" ON kb_publication_obligation 
  FOR ALL 
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

-- ============================================================================
-- 5. Remove duplicate index
-- ============================================================================

DROP INDEX IF EXISTS idx_bfsi_org_name_unique;

-- ============================================================================
-- 6. Add missing index on classic_papers.publication_id
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_classic_papers_publication_id 
ON classic_papers(publication_id);
