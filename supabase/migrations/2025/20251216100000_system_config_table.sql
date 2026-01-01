-- ============================================================================
-- KB-254: System configuration table for global settings
-- Used for feature flags like discovery_enabled
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT 'true'::jsonb,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

-- Insert default discovery setting
INSERT INTO system_config (key, value, description)
VALUES ('discovery_enabled', 'true'::jsonb, 'Enable/disable automatic discovery runs')
ON CONFLICT (key) DO NOTHING;

-- RLS
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage system_config" ON system_config
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE system_config IS 'Global system configuration key-value store';
