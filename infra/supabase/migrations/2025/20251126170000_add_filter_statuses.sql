-- Add 'fetched' and 'filtered' statuses to ingestion_queue
-- This enables a two-stage pipeline: fetch → filter → enrich
-- 'fetched' = content downloaded, awaiting relevance check
-- 'filtered' = passed relevance check, ready for deep enrichment

ALTER TABLE ingestion_queue 
DROP CONSTRAINT IF EXISTS ingestion_queue_status_check;

ALTER TABLE ingestion_queue
ADD CONSTRAINT ingestion_queue_status_check 
CHECK (status IN ('pending', 'fetched', 'filtered', 'enriched', 'approved', 'rejected'));