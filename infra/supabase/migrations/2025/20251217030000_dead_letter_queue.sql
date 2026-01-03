-- KB-268: Dead Letter Queue with failure metadata
-- Items that fail 3+ times on the same step are quarantined

-- Add dead_letter status to status_lookup
INSERT INTO status_lookup (code, name, description, category, is_terminal, sort_order)
VALUES (599, 'dead_letter', 'Item failed 3+ times on same step, quarantined for manual review', 'terminal', false, 599)
ON CONFLICT (code) DO NOTHING;

-- Add failure tracking columns to ingestion_queue
ALTER TABLE ingestion_queue 
ADD COLUMN IF NOT EXISTS failure_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_failed_step TEXT,
ADD COLUMN IF NOT EXISTS last_error_message TEXT,
ADD COLUMN IF NOT EXISTS last_error_signature TEXT,
ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMPTZ;

-- Index for finding DLQ items quickly
CREATE INDEX IF NOT EXISTS idx_ingestion_queue_dead_letter 
ON ingestion_queue(status_code) WHERE status_code = 599;

-- Comment for documentation
COMMENT ON COLUMN ingestion_queue.failure_count IS 'Number of consecutive failures on current step';
COMMENT ON COLUMN ingestion_queue.last_failed_step IS 'Name of step that last failed (summarize, tag, thumbnail)';
COMMENT ON COLUMN ingestion_queue.last_error_message IS 'Full error message from last failure';
COMMENT ON COLUMN ingestion_queue.last_error_signature IS 'Normalized error (first 100 chars, UUIDs/numbers replaced) for grouping';
COMMENT ON COLUMN ingestion_queue.last_error_at IS 'Timestamp of last failure';
