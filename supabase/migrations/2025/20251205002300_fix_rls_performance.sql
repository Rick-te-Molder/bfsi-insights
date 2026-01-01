-- ============================================================================
-- Fix RLS performance issues
-- ============================================================================
-- 1. Wrap auth.<function>() calls in (select ...) for initplan optimization
-- 2. Consolidate overlapping permissive policies on kb_channel
-- ============================================================================

-- Fix kb_publication policy: wrap auth.role() in select
DROP POLICY IF EXISTS "kb_publication_update_authenticated" ON kb_publication;
CREATE POLICY "kb_publication_update_authenticated" 
  ON kb_publication 
  FOR UPDATE 
  USING ((select auth.role()) = 'authenticated')
  WITH CHECK ((select auth.role()) = 'authenticated');

-- Fix kb_channel policies: remove overlapping SELECT permissions
-- The "Channels are publicly readable" policy already handles SELECT for everyone
-- So we only need authenticated policy for INSERT, UPDATE, DELETE (not ALL)

DROP POLICY IF EXISTS "Authenticated users can modify channels" ON kb_channel;

-- Separate policies for each action to avoid overlap with public SELECT
CREATE POLICY "Authenticated users can insert channels" ON kb_channel
  FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');

CREATE POLICY "Authenticated users can update channels" ON kb_channel
  FOR UPDATE USING ((select auth.role()) = 'authenticated')
  WITH CHECK ((select auth.role()) = 'authenticated');

CREATE POLICY "Authenticated users can delete channels" ON kb_channel
  FOR DELETE USING ((select auth.role()) = 'authenticated');
