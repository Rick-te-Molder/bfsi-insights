-- Remove status 330 (approved) from status_lookup
-- Status 330 was an intermediate state between review and publish that served no purpose
-- The approve action now sets status directly to 400 (published)

-- First, migrate any existing items at status 330 to 400
UPDATE ingestion_queue
SET status_code = 400
WHERE status_code = 330;

-- Delete status 330 from status_lookup
DELETE FROM status_lookup WHERE code = 330;

-- Update any status_history records that reference 330
-- (Keep them for historical tracking, but note the status no longer exists)
COMMENT ON TABLE status_history IS 'Historical status transitions. Note: status 330 (approved) was removed 2025-12-27 - approve now goes directly to 400 (published)';
