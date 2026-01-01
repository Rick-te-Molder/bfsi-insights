-- ============================================================================
-- KB-255: Fix items stuck at enriched (240) - move to pending_review (300)
-- These items were thumbnailed but not advanced to review queue due to bug
-- ============================================================================

UPDATE ingestion_queue
SET status_code = 300
WHERE status_code = 240;
