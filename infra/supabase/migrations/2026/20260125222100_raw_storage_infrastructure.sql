-- Migration: Raw Storage Infrastructure
-- US-1: Infrastructure Setup for raw data storage
-- ADR-004: Raw Data Storage Strategy

-- =============================================================================
-- Storage Buckets
-- Private buckets for raw content and thumbnails
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('kb-raw', 'kb-raw', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('kb-thumb', 'kb-thumb', false)
ON CONFLICT (id) DO NOTHING;

-- Note on RLS: Service role bypasses RLS entirely.
-- Protection comes from:
--   1. public = false on buckets
--   2. No RLS policies granting access to anon or authenticated roles
--   3. Service role key kept server-side only

-- =============================================================================
-- ingestion_queue columns for raw storage
-- =============================================================================

ALTER TABLE ingestion_queue
  ADD COLUMN IF NOT EXISTS raw_ref text,
  ADD COLUMN IF NOT EXISTS thumb_ref text,
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS mime text,
  ADD COLUMN IF NOT EXISTS final_url text,
  ADD COLUMN IF NOT EXISTS original_url text,
  ADD COLUMN IF NOT EXISTS fetch_status int,
  ADD COLUMN IF NOT EXISTS fetch_error text,
  ADD COLUMN IF NOT EXISTS fetched_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS storage_deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deletion_reason text,
  ADD COLUMN IF NOT EXISTS oversize_bytes bigint;

-- =============================================================================
-- CHECK constraints
-- =============================================================================

-- content_hash must be 64-char lowercase hex (SHA-256)
ALTER TABLE ingestion_queue
  ADD CONSTRAINT chk_iq_content_hash_format
  CHECK (content_hash IS NULL OR content_hash ~ '^[0-9a-f]{64}$');

-- fetch_status must be non-negative (HTTP status codes are positive)
ALTER TABLE ingestion_queue
  ADD CONSTRAINT chk_iq_fetch_status_positive
  CHECK (fetch_status IS NULL OR fetch_status >= 0);

-- =============================================================================
-- Indexes for efficient queries
-- =============================================================================

-- Deduplication lookups by content hash
CREATE INDEX IF NOT EXISTS idx_iq_content_hash ON ingestion_queue(content_hash)
  WHERE content_hash IS NOT NULL;

-- GC and takedown updates by raw_ref
CREATE INDEX IF NOT EXISTS idx_iq_raw_ref ON ingestion_queue(raw_ref)
  WHERE raw_ref IS NOT NULL;

-- GC queries for expired content
CREATE INDEX IF NOT EXISTS idx_iq_expires_at ON ingestion_queue(expires_at)
  WHERE expires_at IS NOT NULL;

-- Reference checks: find all rows with a given raw_ref and status
CREATE INDEX IF NOT EXISTS idx_iq_raw_ref_status ON ingestion_queue(raw_ref, status_code)
  WHERE raw_ref IS NOT NULL;

-- =============================================================================
-- Column comments
-- =============================================================================

COMMENT ON COLUMN ingestion_queue.raw_ref IS 'Storage key in kb-raw bucket (format: <hash>.<ext>)';
COMMENT ON COLUMN ingestion_queue.thumb_ref IS 'Storage key in kb-thumb bucket';
COMMENT ON COLUMN ingestion_queue.content_hash IS 'SHA-256 hash of raw content (64-char lowercase hex)';
COMMENT ON COLUMN ingestion_queue.mime IS 'MIME type of raw content';
COMMENT ON COLUMN ingestion_queue.final_url IS 'URL after following redirects';
COMMENT ON COLUMN ingestion_queue.original_url IS 'Original URL before redirects (if different from url)';
COMMENT ON COLUMN ingestion_queue.fetch_status IS 'HTTP status code from fetch';
COMMENT ON COLUMN ingestion_queue.fetch_error IS 'Error message if fetch failed';
COMMENT ON COLUMN ingestion_queue.fetched_at IS 'When raw content was fetched';
COMMENT ON COLUMN ingestion_queue.expires_at IS 'When raw content can be garbage collected';
COMMENT ON COLUMN ingestion_queue.storage_deleted_at IS 'When raw content was deleted from storage';
COMMENT ON COLUMN ingestion_queue.deletion_reason IS 'Reason for deletion (gc, takedown, etc.)';
COMMENT ON COLUMN ingestion_queue.oversize_bytes IS 'Actual file size when content exceeds 50MB limit';
