-- KB-210: Create kb_rejection_pattern table for dynamic rejection criteria
-- Single source of truth for content types that should be auto-rejected by discovery-relevance

CREATE TABLE IF NOT EXISTS kb_rejection_pattern (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL, -- e.g., 'job_posting', 'academic', 'marketing'
  description TEXT NOT NULL, -- Human-readable description for prompt
  patterns TEXT[] NOT NULL, -- Keywords/phrases that trigger this rejection
  max_score SMALLINT NOT NULL DEFAULT 2, -- Maximum score to assign (1-3)
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order SMALLINT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed rejection patterns
INSERT INTO kb_rejection_pattern (name, category, description, patterns, max_score, sort_order) VALUES

('job_posting', 'not_content', 
 'Job postings and career opportunities', 
 ARRAY['we''re hiring', 'join our team', 'job requirements', 'career opportunities', 'senior engineer', 'now hiring', 'apply now', 'job opening', 'position available'],
 2, 10),

('academic_theory', 'low_value',
 'Pure academic/mathematical papers without practical application',
 ARRAY['theoretical framework', 'stochastic volatility', 'jump diffusion', 'brownian motion', 'mathematical model', 'proof of', 'theorem', 'lemma', 'arxiv'],
 3, 20),

('personnel_news', 'not_content',
 'Press releases about personnel changes',
 ARRAY['joins as', 'appointed as', 'promoted to', 'new ceo', 'new cfo', 'executive appointment', 'board appointment'],
 2, 30),

('product_marketing', 'low_value',
 'Product marketing and sales pitches without insight',
 ARRAY['buy our', 'purchase now', 'special offer', 'limited time', 'free trial', 'sign up today', 'get started free'],
 2, 40),

('consumer_finance', 'wrong_audience',
 'Consumer financial advice not for BFSI professionals',
 ARRAY['save money on your', 'tips to save', 'personal finance', 'how to budget', 'credit score tips', 'best mortgage rates', 'refinance your'],
 2, 50),

('event_announcement', 'not_content',
 'Event announcements without substantive content',
 ARRAY['register now', 'webinar registration', 'conference dates', 'event registration', 'save the date', 'rsvp'],
 2, 60),

('company_news', 'low_value',
 'Company news without industry insight',
 ARRAY['office opening', 'new headquarters', 'award winner', 'partnership announced', 'milestone reached'],
 3, 70)

ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  patterns = EXCLUDED.patterns,
  max_score = EXCLUDED.max_score,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_kb_rejection_pattern_active ON kb_rejection_pattern(is_active) WHERE is_active = true;

-- RLS
ALTER TABLE kb_rejection_pattern ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on kb_rejection_pattern" ON kb_rejection_pattern
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Public read access on kb_rejection_pattern" ON kb_rejection_pattern
  FOR SELECT TO anon, authenticated USING (true);

COMMENT ON TABLE kb_rejection_pattern IS 'Content rejection patterns for discovery-relevance agent. KB-210.';
COMMENT ON COLUMN kb_rejection_pattern.patterns IS 'Array of keywords/phrases that trigger rejection (case-insensitive matching)';
COMMENT ON COLUMN kb_rejection_pattern.max_score IS 'Maximum relevance score to assign when pattern matches (1-3)';
