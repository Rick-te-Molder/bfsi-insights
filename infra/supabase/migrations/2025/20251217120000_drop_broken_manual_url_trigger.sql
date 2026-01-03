-- ============================================================================
-- KB-276: Drop broken trigger that references dropped status column
-- ============================================================================
-- The trigger_auto_process_url() function references NEW.status which no longer
-- exists, causing all inserts to ingestion_queue to fail.
-- ============================================================================

DROP TRIGGER IF EXISTS on_manual_url_added ON ingestion_queue;
DROP FUNCTION IF EXISTS trigger_auto_process_url() CASCADE;
