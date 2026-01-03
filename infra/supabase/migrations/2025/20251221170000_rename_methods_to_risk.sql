-- ============================================================================
-- Migration: Rename 'methods' topic to 'risk'
-- ============================================================================
-- Issue: 'methods' topic is ambiguous - could mean research methodology or
--        the subject matter. For a BFSI knowledge base, 'risk' is more relevant.
-- 
-- Solution: Rename methods → risk in bfsi_topic table and update all references
-- ============================================================================

-- 1. Update the topic code in bfsi_topic table
UPDATE bfsi_topic 
SET code = 'risk', 
    name = 'Risk',
    description = 'Risk management, risk assessment, risk frameworks, and risk-related content'
WHERE code = 'methods';

-- 2. Update existing publication associations
UPDATE kb_publication_bfsi_topic 
SET topic_code = 'risk' 
WHERE topic_code = 'methods';

-- 3. Verify the change
DO $$
DECLARE
  topic_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO topic_count FROM bfsi_topic WHERE code = 'risk';
  IF topic_count = 0 THEN
    RAISE EXCEPTION 'Migration failed: risk topic not found';
  END IF;
  
  SELECT COUNT(*) INTO topic_count FROM bfsi_topic WHERE code = 'methods';
  IF topic_count > 0 THEN
    RAISE EXCEPTION 'Migration failed: methods topic still exists';
  END IF;
  
  RAISE NOTICE 'Successfully renamed methods → risk';
END $$;
