-- KB-171: Add channels and refine source categories
-- 
-- This migration implements the strategic content structure from KB-169:
-- 1. Creates kb_channel table for 6 strategic information streams
-- 2. Adds channel_slug FK to kb_source
-- 3. Refines category values for source types
-- 4. Maps existing sources to channels

-- ============================================================
-- 1. CREATE kb_channel TABLE
-- ============================================================
-- Channels represent strategic information streams that group sources
-- by their role in the knowledge platform

CREATE TABLE IF NOT EXISTS kb_channel (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,  -- emoji or icon identifier
  sort_order INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comment for documentation
COMMENT ON TABLE kb_channel IS 'Strategic information streams for content categorization (KB-169)';
COMMENT ON COLUMN kb_channel.slug IS 'URL-safe identifier';
COMMENT ON COLUMN kb_channel.name IS 'Display name';
COMMENT ON COLUMN kb_channel.description IS 'Purpose and scope of this channel';

-- Seed the 6 strategic channels
INSERT INTO kb_channel (slug, name, description, icon, sort_order) VALUES
  ('regulatory_intelligence', 'Regulatory Intelligence', 
   'Official regulatory publications, guidelines, consultations, and enforcement from supervisory authorities (EBA, ESMA, EIOPA, ECB, DNB, AFM, FCA, MAS, etc.)', 
   '⚖️', 10),
  ('prudential_statistics', 'Prudential & Risk Statistics', 
   'Statistical data, risk metrics, and quantitative reports from central banks, BIS, IMF, FATF, and statistical agencies', 
   '📊', 20),
  ('market_disclosures', 'Market Disclosures', 
   'Annual reports, 10-K/10-Q filings, investor relations, and corporate disclosures from banks, insurers, fintechs, and servicers', 
   '📈', 30),
  ('vendor_innovation', 'Vendor & Innovation Insights', 
   'Product updates, case studies, whitepapers, and technical content from BFSI vendors and AI/agentic technology providers', 
   '🚀', 40),
  ('academic_research', 'Academic & Technical Research', 
   'Peer-reviewed papers, working papers, and research from arXiv, SSRN, BIS, universities, and research institutes', 
   '🎓', 50),
  ('open_datasets', 'Open Datasets & Indicators', 
   'Structured datasets, APIs, and indicators from Open Banking, CBS, KNMI, World Bank, and other open data sources', 
   '📦', 60)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order;

-- ============================================================
-- 2. ADD channel_slug TO kb_source
-- ============================================================

ALTER TABLE kb_source 
  ADD COLUMN IF NOT EXISTS channel_slug TEXT REFERENCES kb_channel(slug);

-- Add index for filtering by channel
CREATE INDEX IF NOT EXISTS idx_kb_source_channel ON kb_source(channel_slug);

COMMENT ON COLUMN kb_source.channel_slug IS 'Strategic channel this source belongs to';

-- ============================================================
-- 3. REFINE CATEGORY VALUES
-- ============================================================
-- Categories describe what kind of organization produced the content
-- 
-- Old values: big4, strategy-consulting, vendor, research, regulator, publication
-- New values: regulator, central_bank, vendor, research, media_outlet, consulting, 
--             standards_body, academic, government_body

-- Drop old constraint FIRST to allow updates
ALTER TABLE kb_source DROP CONSTRAINT IF EXISTS ref_source_category_check;

-- Now migrate existing values to new taxonomy
UPDATE kb_source SET category = 'consulting' WHERE category = 'big4';
UPDATE kb_source SET category = 'consulting' WHERE category = 'strategy-consulting';
UPDATE kb_source SET category = 'media_outlet' WHERE category = 'publication';
ALTER TABLE kb_source ADD CONSTRAINT kb_source_category_check 
  CHECK (category IN (
    'regulator',        -- Supervisory authorities (EBA, ESMA, AFM, FCA, etc.)
    'central_bank',     -- Central banks (ECB, Fed, DNB monetary policy)
    'vendor',           -- Technology vendors (BFSI and AI/agentic)
    'research',         -- Research organizations, think tanks
    'media_outlet',     -- News, trade publications
    'consulting',       -- Big 4, strategy consulting firms
    'standards_body',   -- NIST, ISO, BCBS, FATF, W3C
    'academic',         -- Universities, academic publishers
    'government_body'   -- Government agencies (non-regulatory)
  ));

-- ============================================================
-- 4. MAP EXISTING SOURCES TO CHANNELS
-- ============================================================
-- Based on current category and known source purposes

-- Regulators → regulatory_intelligence
UPDATE kb_source SET channel_slug = 'regulatory_intelligence' 
WHERE category = 'regulator';

-- Central banks with statistical focus → prudential_statistics (override later if needed)
-- Central banks with regulatory focus → regulatory_intelligence
UPDATE kb_source SET channel_slug = 'regulatory_intelligence' 
WHERE category = 'central_bank';

-- Vendors → vendor_innovation
UPDATE kb_source SET channel_slug = 'vendor_innovation' 
WHERE category = 'vendor';

-- Research (BIS working papers, think tanks) → academic_research
UPDATE kb_source SET channel_slug = 'academic_research' 
WHERE category = 'research';

-- Academic → academic_research
UPDATE kb_source SET channel_slug = 'academic_research' 
WHERE category = 'academic';

-- Consulting → vendor_innovation (they publish insights similar to vendors)
UPDATE kb_source SET channel_slug = 'vendor_innovation' 
WHERE category = 'consulting';

-- Media → varies, default to vendor_innovation for now
UPDATE kb_source SET channel_slug = 'vendor_innovation' 
WHERE category = 'media_outlet';

-- Standards bodies → regulatory_intelligence (standards inform regulation)
UPDATE kb_source SET channel_slug = 'regulatory_intelligence' 
WHERE category = 'standards_body';

-- ============================================================
-- 5. SPECIFIC SOURCE CHANNEL OVERRIDES
-- ============================================================
-- Some sources need specific channel assignments based on their content focus

-- arXiv and SSRN are clearly academic
UPDATE kb_source SET channel_slug = 'academic_research' 
WHERE slug IN ('arxiv', 'arxiv-q-fin', 'ssrn');

-- BIS has both research and statistics - put in academic for papers
UPDATE kb_source SET channel_slug = 'academic_research' 
WHERE slug = 'bis' AND category = 'research';

-- ECB, Fed, DNB statistics → prudential_statistics
-- (We may need to split these sources later, but for now keep in regulatory)

-- ============================================================
-- 6. ADD RLS POLICY FOR kb_channel
-- ============================================================

ALTER TABLE kb_channel ENABLE ROW LEVEL SECURITY;

-- Everyone can read channels
CREATE POLICY "Channels are publicly readable" ON kb_channel
  FOR SELECT USING (true);

-- Only authenticated users can modify (admin)
CREATE POLICY "Authenticated users can modify channels" ON kb_channel
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================
-- 7. UPDATE kb_publication_pretty VIEW (if channel should be visible)
-- ============================================================
-- This is optional - add channel to the view if needed for filtering
-- We'll do this in a separate migration if required

