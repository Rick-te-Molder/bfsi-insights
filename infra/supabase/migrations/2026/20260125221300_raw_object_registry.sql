-- Migration: Raw Object Registry
-- US-0: Create centralized registry for raw content objects
-- ADR-004: Raw Data Storage Strategy

-- =============================================================================
-- raw_object table
-- Centralized registry for content-addressed raw objects stored in Supabase Storage
-- =============================================================================

CREATE TABLE raw_object (
  content_hash text PRIMARY KEY CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  raw_ref text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  mime_detected text,
  bytes bigint,
  raw_store_mode text CHECK (raw_store_mode IN ('full', 'partial', 'none'))
);

COMMENT ON TABLE raw_object IS 'Centralized registry of raw content objects stored in Supabase Storage (ADR-004)';
COMMENT ON COLUMN raw_object.content_hash IS 'SHA-256 hash of content bytes (64-char lowercase hex)';
COMMENT ON COLUMN raw_object.raw_ref IS 'Storage key in kb-raw bucket (format: <hash>.<ext>)';
COMMENT ON COLUMN raw_object.first_seen_at IS 'When this content was first ingested';
COMMENT ON COLUMN raw_object.mime_detected IS 'MIME type detected via byte sniffing';
COMMENT ON COLUMN raw_object.bytes IS 'File size in bytes';
COMMENT ON COLUMN raw_object.raw_store_mode IS 'Storage mode: full (complete), partial (first 5MB), none (hash only)';

-- Index for GC lookups (find all objects by storage key)
CREATE INDEX idx_raw_object_raw_ref ON raw_object(raw_ref);

-- =============================================================================
-- takedown_blocklist table
-- Prevents re-ingestion of content that has been taken down for legal/compliance
-- =============================================================================

CREATE TABLE takedown_blocklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_hash text REFERENCES raw_object(content_hash) ON DELETE SET NULL,
  url_pattern text,
  reason text NOT NULL,
  requested_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT has_target CHECK (content_hash IS NOT NULL OR url_pattern IS NOT NULL)
);

COMMENT ON TABLE takedown_blocklist IS 'Blocklist to prevent re-ingestion of taken-down content (ADR-004)';
COMMENT ON COLUMN takedown_blocklist.content_hash IS 'SHA-256 hash of blocked content (optional)';
COMMENT ON COLUMN takedown_blocklist.url_pattern IS 'URL pattern to block (optional, supports wildcards)';
COMMENT ON COLUMN takedown_blocklist.reason IS 'Reason for takedown (legal, compliance, etc.)';
COMMENT ON COLUMN takedown_blocklist.requested_by IS 'Who requested the takedown';

-- Index for fast blocklist lookups during ingestion
CREATE INDEX idx_takedown_blocklist_content_hash ON takedown_blocklist(content_hash) WHERE content_hash IS NOT NULL;
CREATE INDEX idx_takedown_blocklist_url_pattern ON takedown_blocklist(url_pattern) WHERE url_pattern IS NOT NULL;
