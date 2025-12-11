-- Migration: Create missed_discovery table for KB-214
-- Purpose: Capture URLs that clients share which the system missed,
--          enabling continuous improvement of discovery coverage

CREATE TABLE missed_discovery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- The URL itself
  url TEXT NOT NULL,
  url_norm TEXT NOT NULL,
  
  -- Submitter identity
  submitter_name TEXT,
  submitter_type TEXT CHECK (submitter_type IN ('client', 'internal', 'partner')),
  submitter_audience TEXT CHECK (submitter_audience IN ('executive', 'functional_specialist', 'engineer', 'researcher')),
  submitter_channel TEXT CHECK (submitter_channel IN ('email', 'slack', 'linkedin', 'meeting', 'whatsapp', 'other')),
  submitted_at TIMESTAMPTZ DEFAULT now(),
  
  -- Why this matters (THE GOLD)
  why_valuable TEXT,
  submitter_urgency TEXT CHECK (submitter_urgency IN ('fyi', 'important', 'critical')),
  verbatim_comment TEXT,
  
  -- Content classification
  suggested_audiences TEXT[],
  suggested_topics TEXT[],
  suggested_industries TEXT[],
  suggested_geographies TEXT[],
  
  -- Source analysis (auto-filled)
  source_domain TEXT,
  source_type TEXT CHECK (source_type IN ('regulator', 'news', 'consultancy', 'vendor', 'research', 'social', 'unknown')),
  existing_source_slug TEXT,
  
  -- Miss classification (filled by Improver agent)
  miss_category TEXT CHECK (miss_category IN (
    'source_not_tracked',
    'pattern_missing', 
    'pattern_wrong',
    'filter_rejected',
    'crawl_failed',
    'too_slow',
    'link_not_followed',
    'dynamic_content'
  )),
  miss_details JSONB,
  
  -- Resolution tracking
  resolution_status TEXT DEFAULT 'pending' CHECK (resolution_status IN ('pending', 'source_added', 'pattern_added', 'filter_tuned', 'wont_fix', 'duplicate')),
  resolution_action TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  
  -- Learning extraction (by Improver agent)
  improvement_suggestions JSONB,
  contributed_to_source UUID, -- References source.id but no FK to avoid migration order issues
  contributed_to_pattern TEXT,
  
  -- Impact metrics
  days_late INTEGER,
  retroactive_score INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for analytics and querying
CREATE INDEX idx_missed_discovery_source_domain ON missed_discovery(source_domain);
CREATE INDEX idx_missed_discovery_miss_category ON missed_discovery(miss_category);
CREATE INDEX idx_missed_discovery_resolution_status ON missed_discovery(resolution_status);
CREATE INDEX idx_missed_discovery_submitter_audience ON missed_discovery(submitter_audience);
CREATE INDEX idx_missed_discovery_submitted_at ON missed_discovery(submitted_at DESC);
CREATE INDEX idx_missed_discovery_url_norm ON missed_discovery(url_norm);

-- Trigger to update updated_at
CREATE TRIGGER missed_discovery_updated_at
  BEFORE UPDATE ON missed_discovery
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS policies
ALTER TABLE missed_discovery ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all missed discoveries
CREATE POLICY "Allow authenticated read" ON missed_discovery
  FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to insert missed discoveries
CREATE POLICY "Allow authenticated insert" ON missed_discovery
  FOR INSERT TO authenticated WITH CHECK (true);

-- Allow authenticated users to update missed discoveries
CREATE POLICY "Allow authenticated update" ON missed_discovery
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Allow service role full access
CREATE POLICY "Allow service role all" ON missed_discovery
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Comment on table
COMMENT ON TABLE missed_discovery IS 'Tracks URLs that clients share which the system missed, enabling continuous improvement of discovery coverage';
COMMENT ON COLUMN missed_discovery.why_valuable IS 'The gold - why the submitter found this valuable. Reveals user intent and content gaps.';
COMMENT ON COLUMN missed_discovery.submitter_audience IS 'Which of the 4 target audiences the submitter belongs to';
COMMENT ON COLUMN missed_discovery.miss_category IS 'Classification of why the system missed this URL';
