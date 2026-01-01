-- ============================================================================
-- KB-257: Fix items stuck in summarizing (211) and pending_enrichment (200)
-- Reset summarizing items back to to_summarize so they can be reprocessed
-- ============================================================================

-- Reset summarizing items (211) back to to_summarize (210)
UPDATE ingestion_queue
SET status_code = 210
WHERE status_code = 211;

-- Note: pending_enrichment (200) items are waiting to be fetched - no reset needed
-- They will be picked up by the next enrichment run
