-- Migration: Fix approval workflow and add missing columns
-- Run date: 2024-11-24
-- Purpose: Add missing approved_at column and clean up workflow

-- ============================================================================
-- PART 1: Add missing columns
-- ============================================================================

ALTER TABLE ingestion_queue 
ADD COLUMN IF NOT EXISTS approved_at timestamptz;

ALTER TABLE ingestion_queue 
ADD COLUMN IF NOT EXISTS reviewer uuid REFERENCES auth.users(id);

-- ============================================================================
-- PART 2: Create indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_ingestion_queue_approved_at 
ON ingestion_queue(approved_at) 
WHERE approved_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ingestion_queue_reviewer 
ON ingestion_queue(reviewer) 
WHERE reviewer IS NOT NULL;

-- ============================================================================
-- PART 3: Add helpful comments
-- ============================================================================

COMMENT ON COLUMN ingestion_queue.approved_at IS 'Timestamp when human approved for publishing';
COMMENT ON COLUMN ingestion_queue.reviewer IS 'User ID who approved/rejected the item';

-- ============================================================================
-- PART 4: Verify
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Approval workflow columns added successfully';
  RAISE NOTICE 'approved_at type: %', 
    (SELECT data_type FROM information_schema.columns 
     WHERE table_name = 'ingestion_queue' AND column_name = 'approved_at');
END $$;