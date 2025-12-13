-- Migration: Deprecate ingestion_queue.status (text) in favor of status_code (smallint)
-- All code now uses status_code exclusively. This migration:
-- 1. Ensures status_code is NOT NULL with default
-- 2. Adds a trigger to block writes to the deprecated status column
-- 3. Adds a comment marking the column as deprecated

-- Step 1: Ensure status_code has a default and is NOT NULL
-- First backfill any NULLs (shouldn't exist, but be safe)
UPDATE ingestion_queue 
SET status_code = 200 
WHERE status_code IS NULL;

-- Add default if not exists and make NOT NULL
ALTER TABLE ingestion_queue 
  ALTER COLUMN status_code SET DEFAULT 200,
  ALTER COLUMN status_code SET NOT NULL;

-- Step 2: Create trigger function to block writes to deprecated status column
CREATE OR REPLACE FUNCTION block_status_text_write()
RETURNS TRIGGER AS $$
BEGIN
  -- Only block if someone is trying to change the status text column
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'ingestion_queue.status (text) is deprecated. Use status_code instead.';
  END IF;
  
  IF TG_OP = 'INSERT' AND NEW.status IS NOT NULL THEN
    -- Allow inserts but clear the status field (don't fail, just ignore)
    NEW.status := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create trigger on ingestion_queue
DROP TRIGGER IF EXISTS block_status_text_write_trigger ON ingestion_queue;
CREATE TRIGGER block_status_text_write_trigger
  BEFORE INSERT OR UPDATE ON ingestion_queue
  FOR EACH ROW
  EXECUTE FUNCTION block_status_text_write();

-- Step 4: Add comment to mark column as deprecated
COMMENT ON COLUMN ingestion_queue.status IS 'DEPRECATED: Use status_code instead. This column is blocked from writes.';

-- Step 5: Clear existing status text values (optional cleanup)
-- This nullifies the deprecated column data
UPDATE ingestion_queue SET status = NULL WHERE status IS NOT NULL;
