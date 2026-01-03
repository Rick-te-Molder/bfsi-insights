-- ============================================================================
-- KB-235: Archive strategy for ingestion_queue
-- ============================================================================
-- Creates archive table, seen_urls deduplication table, and function to move
-- old completed items out of the main queue.
--
-- RETENTION POLICY:
-- - Items with terminal status (approved/rejected/published) older than 90 days
--   are moved to the archive table
-- - Pending/in-progress items are NEVER archived
-- - Archived items remain queryable for audits
--
-- DEDUPLICATION STRATEGY:
-- - seen_urls table tracks all URLs that should not be re-discovered
-- - Approved/published items are added to seen_urls (permanent block)
-- - Rejected items are NOT added to seen_urls (allows re-evaluation if
--   prompts/taxonomy change and content is still on source feeds)
-- ============================================================================

-- ============================================================================
-- 1. Create seen_urls Table (Deduplication Index)
-- ============================================================================
-- Lightweight table to prevent re-discovery of archived items.
-- The discoverer checks this FIRST before checking ingestion_queue.

CREATE TABLE IF NOT EXISTS seen_urls (
  url_norm text PRIMARY KEY,
  first_seen_at timestamptz DEFAULT now(),
  final_status_code smallint,  -- 500=approved, 600=published
  archived_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seen_urls_status ON seen_urls(final_status_code);

COMMENT ON TABLE seen_urls IS 'Deduplication index for archived URLs. Discoverer checks this first to avoid re-processing approved/published content.';

-- ============================================================================
-- 2. Create Archive Table
-- ============================================================================
-- Mirror structure of ingestion_queue, but without unique constraints on
-- url_norm/content_hash (archived items don't need uniqueness enforcement)

CREATE TABLE IF NOT EXISTS ingestion_queue_archive (
  id uuid PRIMARY KEY,
  
  -- Core identifiers
  url text NOT NULL,
  url_norm text,
  content_hash text,
  
  -- Workflow
  status text,
  status_code smallint,
  content_type text,
  entry_type text,
  
  -- Payload
  payload jsonb NOT NULL,
  payload_schema_version int,
  
  -- Storage references
  raw_ref text,
  thumb_ref text,
  
  -- HTTP metadata
  etag text,
  last_modified timestamptz,
  
  -- Timestamps
  discovered_at timestamptz,
  fetched_at timestamptz,
  reviewed_at timestamptz,
  approved_at timestamptz,
  
  -- Audit
  reviewer uuid,
  rejection_reason text,
  
  -- AI metadata
  prompt_version text,
  model_id text,
  agent_metadata jsonb,
  
  -- Archive metadata
  archived_at timestamptz DEFAULT now()
);

-- Index for querying archived items
CREATE INDEX IF NOT EXISTS idx_archive_discovered_at ON ingestion_queue_archive(discovered_at DESC);
CREATE INDEX IF NOT EXISTS idx_archive_status_code ON ingestion_queue_archive(status_code);
CREATE INDEX IF NOT EXISTS idx_archive_url_norm ON ingestion_queue_archive(url_norm);

COMMENT ON TABLE ingestion_queue_archive IS 'Archived ingestion_queue items. Items older than 90 days with terminal status are moved here.';

-- ============================================================================
-- 3. Create Archive Function
-- ============================================================================
-- Moves items with terminal status (approved/rejected/published) older than
-- the specified number of days to the archive table.
--
-- Terminal status codes (from status_lookup):
-- 500 = approved
-- 600 = published  
-- 700 = rejected
--
-- IMPORTANT: Only approved/published items are added to seen_urls.
-- Rejected items can be re-discovered and re-evaluated if prompts change.

CREATE OR REPLACE FUNCTION archive_old_queue_items(days_old int DEFAULT 90)
RETURNS TABLE(archived_count int, seen_urls_count int, oldest_remaining timestamptz) AS $$
DECLARE
  v_cutoff timestamptz;
  v_archived int;
  v_seen int;
  v_oldest timestamptz;
BEGIN
  v_cutoff := now() - (days_old || ' days')::interval;
  
  -- Step 1: Move old terminal items to archive
  WITH moved AS (
    DELETE FROM ingestion_queue
    WHERE discovered_at < v_cutoff
      AND status_code IN (500, 600, 700)  -- approved, published, rejected
    RETURNING *
  )
  INSERT INTO ingestion_queue_archive (
    id, url, url_norm, content_hash,
    status, status_code, content_type, entry_type,
    payload, payload_schema_version,
    raw_ref, thumb_ref,
    etag, last_modified,
    discovered_at, fetched_at, reviewed_at, approved_at,
    reviewer, rejection_reason,
    prompt_version, model_id, agent_metadata
  )
  SELECT 
    id, url, url_norm, content_hash,
    status, status_code, content_type, entry_type,
    payload, payload_schema_version,
    raw_ref, thumb_ref,
    etag, last_modified,
    discovered_at, fetched_at, reviewed_at, approved_at,
    reviewer, rejection_reason,
    prompt_version, model_id, agent_metadata
  FROM moved;
  
  GET DIAGNOSTICS v_archived = ROW_COUNT;
  
  -- Step 2: Add approved/published items to seen_urls (NOT rejected)
  -- This prevents re-discovery of successfully processed content
  INSERT INTO seen_urls (url_norm, first_seen_at, final_status_code)
  SELECT url_norm, discovered_at, status_code
  FROM ingestion_queue_archive
  WHERE archived_at >= now() - interval '1 minute'  -- Just archived
    AND status_code IN (500, 600)  -- Only approved/published, NOT rejected
  ON CONFLICT (url_norm) DO NOTHING;
  
  GET DIAGNOSTICS v_seen = ROW_COUNT;
  
  -- Get oldest remaining item timestamp
  SELECT MIN(discovered_at) INTO v_oldest FROM ingestion_queue;
  
  archived_count := v_archived;
  seen_urls_count := v_seen;
  oldest_remaining := v_oldest;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION archive_old_queue_items IS 'Archives queue items with terminal status older than N days. Usage: SELECT * FROM archive_old_queue_items(90);';

-- ============================================================================
-- 4. Documentation
-- ============================================================================

COMMENT ON TABLE ingestion_queue IS 'Lightweight queue for discovery, enrichment, and review.

RETENTION POLICY (KB-235):
- Items with terminal status (approved/rejected/published) older than 90 days
  are eligible for archival to ingestion_queue_archive
- Run: SELECT * FROM archive_old_queue_items(90);
- Pending/in-progress items are NEVER archived
- Approved/published items are added to seen_urls (prevents re-discovery)
- Rejected items are NOT added to seen_urls (allows re-evaluation)

DEDUPLICATION (KB-235):
- Discoverer checks seen_urls FIRST, then ingestion_queue
- seen_urls contains only approved/published URLs (permanent block)
- Rejected URLs can be re-discovered if still on source feeds

INDEX STRATEGY (KB-234):
- idx_queue_status_discovered: Composite for dashboard (status_code + discovered_at DESC)
- idx_queue_payload_gin: GIN index for JSONB payload queries
- idx_queue_url_norm: UNIQUE for deduplication
- idx_queue_content_hash: UNIQUE for content deduplication';
