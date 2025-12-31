-- Validation queries to run AFTER the schema standardization migration
-- Run these to verify all changes were applied correctly

-- ============================================================================
-- 1. Check entity tables have slug column
-- ============================================================================
SELECT 'bfsi_organization has slug' as check_name, 
  EXISTS(SELECT 1 FROM information_schema.columns 
         WHERE table_name = 'bfsi_organization' AND column_name = 'slug') as passed;

SELECT 'ag_vendor has slug' as check_name,
  EXISTS(SELECT 1 FROM information_schema.columns 
         WHERE table_name = 'ag_vendor' AND column_name = 'slug') as passed;

-- ============================================================================
-- 2. Check UUID primary keys
-- ============================================================================
SELECT 'regulator.id is uuid' as check_name,
  (SELECT data_type FROM information_schema.columns 
   WHERE table_name = 'regulator' AND column_name = 'id') = 'uuid' as passed;

SELECT 'standard_setter.id is uuid' as check_name,
  (SELECT data_type FROM information_schema.columns 
   WHERE table_name = 'standard_setter' AND column_name = 'id') = 'uuid' as passed;

SELECT 'regulation.id is uuid' as check_name,
  (SELECT data_type FROM information_schema.columns 
   WHERE table_name = 'regulation' AND column_name = 'id') = 'uuid' as passed;

SELECT 'ag_use_case.id is uuid' as check_name,
  (SELECT data_type FROM information_schema.columns 
   WHERE table_name = 'ag_use_case' AND column_name = 'id') = 'uuid' as passed;

-- ============================================================================
-- 3. Check kb_category and kb_channel have id uuid and code
-- ============================================================================
SELECT 'kb_category has id uuid' as check_name,
  (SELECT data_type FROM information_schema.columns 
   WHERE table_name = 'kb_category' AND column_name = 'id') = 'uuid' as passed;

SELECT 'kb_category has code' as check_name,
  EXISTS(SELECT 1 FROM information_schema.columns 
         WHERE table_name = 'kb_category' AND column_name = 'code') as passed;

SELECT 'kb_channel has id uuid' as check_name,
  (SELECT data_type FROM information_schema.columns 
   WHERE table_name = 'kb_channel' AND column_name = 'id') = 'uuid' as passed;

SELECT 'kb_channel has code' as check_name,
  EXISTS(SELECT 1 FROM information_schema.columns 
         WHERE table_name = 'kb_channel' AND column_name = 'code') as passed;

-- ============================================================================
-- 4. Check table renames
-- ============================================================================
SELECT 'kb_topic exists' as check_name,
  EXISTS(SELECT 1 FROM information_schema.tables 
         WHERE table_name = 'kb_topic') as passed;

SELECT 'bfsi_topic does not exist' as check_name,
  NOT EXISTS(SELECT 1 FROM information_schema.tables 
             WHERE table_name = 'bfsi_topic') as passed;

SELECT 'kb_publication_kb_topic exists' as check_name,
  EXISTS(SELECT 1 FROM information_schema.tables 
         WHERE table_name = 'kb_publication_kb_topic') as passed;

-- ============================================================================
-- 5. Check column renames
-- ============================================================================
SELECT 'bfsi_organization.name exists' as check_name,
  EXISTS(SELECT 1 FROM information_schema.columns 
         WHERE table_name = 'bfsi_organization' AND column_name = 'name') as passed;

SELECT 'bfsi_organization.organization_name does not exist' as check_name,
  NOT EXISTS(SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'bfsi_organization' AND column_name = 'organization_name') as passed;

SELECT 'kb_source.channel_code exists' as check_name,
  EXISTS(SELECT 1 FROM information_schema.columns 
         WHERE table_name = 'kb_source' AND column_name = 'channel_code') as passed;

-- ============================================================================
-- 6. Count rows to ensure no data loss
-- ============================================================================
SELECT 'regulator row count' as check_name, COUNT(*) as count FROM regulator;
SELECT 'standard_setter row count' as check_name, COUNT(*) as count FROM standard_setter;
SELECT 'bfsi_organization row count' as check_name, COUNT(*) as count FROM bfsi_organization;
SELECT 'ag_vendor row count' as check_name, COUNT(*) as count FROM ag_vendor;
SELECT 'kb_topic row count' as check_name, COUNT(*) as count FROM kb_topic;
SELECT 'regulation row count' as check_name, COUNT(*) as count FROM regulation;
SELECT 'ag_use_case row count' as check_name, COUNT(*) as count FROM ag_use_case;

-- ============================================================================
-- Expected results:
-- - All "passed" columns should be TRUE
-- - Row counts should match pre-migration counts:
--   regulator: 22, standard_setter: 10, bfsi_organization: 8, 
--   ag_vendor: 81, kb_topic: 5, regulation: 18, ag_use_case: 16
-- ============================================================================
