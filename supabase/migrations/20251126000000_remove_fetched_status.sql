-- Migration: Remove 'fetched' status from ingestion_queue
-- Run date: 2025-11-26
-- Purpose: Clean up invalid 'fetched' status values and update workflow to use 'pending' instead

-- Update all existing 'fetched' records to 'pending'
UPDATE ingestion_queue 
SET status = 'pending' 
WHERE status = 'fetched';

-- Add comment documenting the status workflow
COMMENT ON COLUMN ingestion_queue.status IS 'Valid values: pending (awaiting enrichment), enriched (ready for review), approved (published), rejected (not relevant). Workflow: pending → enriched → approved/rejected';