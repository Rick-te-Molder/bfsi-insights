-- Migration: Takedown Log
-- US-8: Takedown Capability
-- ADR-004: Raw Data Storage Strategy

-- =============================================================================
-- takedown_log table
-- Audit trail for all takedown operations
-- =============================================================================

CREATE TABLE takedown_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL CHECK (target_type IN ('content_hash', 'url', 'queue_id')),
  target_value text NOT NULL,
  raw_ref text,
  reason text NOT NULL,
  requested_by text NOT NULL,
  rows_affected int,
  outcome text NOT NULL CHECK (outcome IN ('success', 'not_found', 'error')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE takedown_log IS 'Audit trail for takedown operations (ADR-004)';
COMMENT ON COLUMN takedown_log.target_type IS 'Type of target: content_hash, url, or queue_id';
COMMENT ON COLUMN takedown_log.target_value IS 'The actual hash, URL, or queue ID that was targeted';
COMMENT ON COLUMN takedown_log.raw_ref IS 'Storage key that was deleted (if applicable)';
COMMENT ON COLUMN takedown_log.reason IS 'Reason for takedown (legal, compliance, etc.)';
COMMENT ON COLUMN takedown_log.requested_by IS 'Who requested the takedown';
COMMENT ON COLUMN takedown_log.rows_affected IS 'Number of ingestion_queue rows updated';
COMMENT ON COLUMN takedown_log.outcome IS 'Result: success, not_found, or error';
COMMENT ON COLUMN takedown_log.error_message IS 'Error details if outcome is error';

-- Index for audit queries
CREATE INDEX idx_takedown_log_created_at ON takedown_log(created_at DESC);
CREATE INDEX idx_takedown_log_target ON takedown_log(target_type, target_value);

-- Grant access to service role
GRANT SELECT, INSERT ON takedown_log TO service_role;
