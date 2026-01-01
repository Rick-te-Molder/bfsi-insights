-- ============================================================================
-- KB-245: Add reviewed_by column to ingestion_queue
-- ============================================================================
-- Adds user attribution to review actions for accountability.
-- ============================================================================

-- Add reviewed_by column to track who approved/rejected items
ALTER TABLE ingestion_queue 
ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id);

-- Add index for querying by reviewer
CREATE INDEX IF NOT EXISTS idx_ingestion_queue_reviewed_by 
ON ingestion_queue(reviewed_by) 
WHERE reviewed_by IS NOT NULL;

-- Add comment
COMMENT ON COLUMN ingestion_queue.reviewed_by IS 'User ID who approved/rejected this item (from auth.users)';

-- =============================================================================
-- Add created_by column to prompt_version
-- =============================================================================

ALTER TABLE prompt_version 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

COMMENT ON COLUMN prompt_version.created_by IS 'User ID who created this prompt version';
