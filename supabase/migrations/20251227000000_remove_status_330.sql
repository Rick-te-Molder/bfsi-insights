-- Remove status 330 (approved) from status_lookup
-- Status 330 was an intermediate state between review and publish that served no purpose
-- The approve action now sets status directly to 400 (published)

-- First, migrate any existing items at status 330 to 400
UPDATE ingestion_queue
SET status_code = 400
WHERE status_code = 330;

-- Update status_history records that reference 330 (both from_status and to_status)
-- Convert 330 transitions to 400 for consistency
UPDATE status_history
SET from_status = 400
WHERE from_status = 330;

UPDATE status_history
SET to_status = 400
WHERE to_status = 330;

-- Now we can safely delete status 330 from status_lookup
DELETE FROM status_lookup WHERE code = 330;

-- Add comment noting the historical change
COMMENT ON TABLE status_history IS 'Historical status transitions. Note: status 330 (approved) was removed 2025-12-27 and converted to 400 in historical records - approve now goes directly to 400 (published)';
