-- Migration: Filter configuration
-- Purpose: Define which columns are filterable dynamically from database

CREATE TABLE ref_filter_config (
  column_name text PRIMARY KEY,
  display_label text NOT NULL,
  filter_type text NOT NULL DEFAULT 'dropdown' CHECK (filter_type IN ('dropdown', 'multi-select', 'search')),
  sort_order int NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE ref_filter_config IS 
  'Defines which kb_resource columns are filterable and their display properties';

COMMENT ON COLUMN ref_filter_config.column_name IS 'Column name in kb_resource table';
COMMENT ON COLUMN ref_filter_config.display_label IS 'Human-readable label shown in UI';
COMMENT ON COLUMN ref_filter_config.filter_type IS 'UI component type for filter';

-- Seed with current filters
INSERT INTO ref_filter_config (column_name, display_label, filter_type, sort_order, description) VALUES
  ('role', 'View for', 'dropdown', 10, 'Target audience role'),
  ('industry', 'Industry', 'dropdown', 20, 'BFSI industry sector'),
  ('content_type', 'Content type', 'dropdown', 30, 'Type of content'),
  ('topic', 'Topic', 'dropdown', 40, 'Subject matter taxonomy'),
  ('geography', 'Geography', 'dropdown', 50, 'Geographic scope: regulatory jurisdiction or market focus');

-- Grant permissions
GRANT SELECT ON ref_filter_config TO anon, authenticated;

-- Enable RLS
ALTER TABLE ref_filter_config ENABLE ROW LEVEL SECURITY;

-- Policy: allow read access to all
CREATE POLICY "ref_filter_config_select_all" ON ref_filter_config
  FOR SELECT USING (true);

-- Policy: admin can manage (authenticated with service key via admin functions)
CREATE POLICY "ref_filter_config_admin" ON ref_filter_config
  FOR ALL TO service_role USING (true) WITH CHECK (true);