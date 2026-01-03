-- Create rejection analytics table
CREATE TABLE IF NOT EXISTS rejection_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rejection_reason text,
  rejection_category text,
  queue_item_id uuid REFERENCES ingestion_queue(id) ON DELETE CASCADE,
  prompt_version text,
  discovered_source text,
  industry text,
  topic text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rejection_analytics_category ON rejection_analytics(rejection_category);
CREATE INDEX IF NOT EXISTS idx_rejection_analytics_created_at ON rejection_analytics(created_at DESC);