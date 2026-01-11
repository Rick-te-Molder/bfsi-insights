-- =============================================================================
-- Migration: Add updated_at column to ingestion_queue
-- =============================================================================
-- The transition_status() function expects an updated_at column for tracking
-- when items last changed status. This column was missing from the original
-- table definition.
-- =============================================================================

-- Add updated_at column with default value
ALTER TABLE public.ingestion_queue
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create index for efficient queries on recently updated items
CREATE INDEX IF NOT EXISTS idx_queue_updated_at 
  ON public.ingestion_queue(updated_at DESC);

-- Backfill existing rows: use discovered_at as initial value
UPDATE public.ingestion_queue
SET updated_at = COALESCE(discovered_at, now())
WHERE updated_at IS NULL;

-- Add NOT NULL constraint after backfill
ALTER TABLE public.ingestion_queue
  ALTER COLUMN updated_at SET NOT NULL;

COMMENT ON COLUMN public.ingestion_queue.updated_at IS 'Timestamp of last status change (updated by transition_status function)';
