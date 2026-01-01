-- ============================================================================
-- KB-256: Fix stuck jobs and items in working status
-- Thumbnailing job stuck at 8/50 for 565+ minutes
-- Tagging items stuck in working status (221)
-- ============================================================================

-- Mark stale running jobs as failed
UPDATE agent_jobs
SET status = 'failed',
    error_message = 'Job timed out (stale) - manual cleanup',
    completed_at = now(),
    current_item_id = NULL,
    current_item_title = NULL
WHERE status = 'running'
  AND started_at < now() - interval '30 minutes';

-- Reset tagging items (221) back to to_tag (220)
UPDATE ingestion_queue
SET status_code = 220
WHERE status_code = 221;

-- Reset thumbnailing items (231) back to to_thumbnail (230)
UPDATE ingestion_queue
SET status_code = 230
WHERE status_code = 231;
