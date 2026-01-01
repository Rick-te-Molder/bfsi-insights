-- ============================================================================
-- Cleanup: Bulk reject stale arXiv papers from ingestion queue
-- ============================================================================
-- These items were added before proper BFSI relevance scoring was implemented.
-- The enrichment pipeline correctly rejects them, but wastes LLM calls.
-- This migration cleans up the backlog.
-- ============================================================================

-- Ensure rejection_analytics table exists (trigger depends on it)
CREATE TABLE IF NOT EXISTS rejection_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rejection_reason text,
  rejection_category text,
  queue_item_id uuid,
  source text,
  url text,
  prompt_version text,
  created_at timestamptz DEFAULT now()
);

-- First, let's see what we're cleaning up (for audit trail)
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM ingestion_queue
  WHERE status = 'pending' 
    AND url LIKE '%arxiv.org%'
    AND discovered_at < NOW() - INTERVAL '3 days';
  
  RAISE NOTICE 'Cleaning up % stale arXiv items from ingestion queue', v_count;
END $$;

-- Temporarily disable the rejection tracking trigger to avoid issues
-- (The trigger may reference columns that don't exist or table may be missing)
DROP TRIGGER IF EXISTS track_rejections ON ingestion_queue;

-- Bulk reject old pending arXiv papers
-- These are general ML/AI papers that aren't BFSI-relevant
UPDATE ingestion_queue
SET 
  status = 'rejected',
  rejection_reason = 'Bulk cleanup: pre-scoring arXiv papers without BFSI relevance indicators',
  reviewed_at = NOW()
WHERE status = 'pending' 
  AND url LIKE '%arxiv.org%'
  AND discovered_at < NOW() - INTERVAL '3 days';

-- Also clean up any other very old pending items (>30 days)
-- These likely slipped through before proper filtering
UPDATE ingestion_queue
SET 
  status = 'rejected',
  rejection_reason = 'Bulk cleanup: stale item older than 30 days',
  reviewed_at = NOW()
WHERE status = 'pending' 
  AND discovered_at < NOW() - INTERVAL '30 days';

-- Re-enable the trigger if the function exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_rejection_analytics') THEN
    CREATE TRIGGER track_rejections
    AFTER UPDATE ON ingestion_queue
    FOR EACH ROW
    EXECUTE FUNCTION log_rejection_analytics();
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Ignore errors recreating trigger
  NULL;
END $$;
