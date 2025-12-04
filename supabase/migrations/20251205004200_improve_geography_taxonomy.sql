-- ============================================================================
-- KB-172: Improve kb_geography taxonomy
-- ============================================================================
-- Comprehensive geography taxonomy with 4 conceptual levels:
--   1. Global (worldwide scope)
--   2. Macro-regions (EMEA, APAC, Americas, Africa)
--   3. Regional blocs (EU, GCC, MENA)
--   4. Countries (ISO-3166 2-letter codes)
--   5. Fallback (other)
-- 
-- Publications can be tagged with multiple geographies, e.g.:
--   - Qatar neobank case → gcc, mena, qa
--   - EU AI Act → eu, emea
--   - Global vendor landscape → global
-- ============================================================================

-- Create table if not exists (in case it was created directly in Supabase)
CREATE TABLE IF NOT EXISTS kb_geography (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS if not already
ALTER TABLE kb_geography ENABLE ROW LEVEL SECURITY;

-- Ensure public read policy exists
DROP POLICY IF EXISTS "Public read geography" ON kb_geography;
DROP POLICY IF EXISTS "Geography is publicly readable" ON kb_geography;
CREATE POLICY "Geography is publicly readable" ON kb_geography FOR SELECT USING (true);

-- ============================================================================
-- Seed/update geography values using UPSERT
-- ============================================================================
-- Preserves existing rows (id, created_at) while updating sort_order/description

-- Global scope
INSERT INTO kb_geography (code, name, sort_order, description) VALUES
  ('global', 'Global', 10, 'Worldwide or multi-region relevance')
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name, sort_order = EXCLUDED.sort_order, description = EXCLUDED.description, updated_at = NOW();

-- Macro-regions (business view)
INSERT INTO kb_geography (code, name, sort_order, description) VALUES
  ('emea', 'Europe, Middle East & Africa', 20, 'Macro-region combining Europe, Middle East and Africa'),
  ('apac', 'Asia-Pacific', 30, 'Asia-Pacific region (East Asia, South Asia, Southeast Asia, Oceania)'),
  ('amer', 'Americas', 40, 'North and South America combined'),
  ('africa', 'Africa', 50, 'African continent (can overlap with EMEA)')
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name, sort_order = EXCLUDED.sort_order, description = EXCLUDED.description, updated_at = NOW();

-- Regional blocs / overlays
INSERT INTO kb_geography (code, name, sort_order, description) VALUES
  ('eu', 'European Union', 100, 'EU-wide focus (regulation, policy, or markets under EU law)'),
  ('mena', 'Middle East & North Africa', 110, 'MENA region (when focus is specifically MENA, not full EMEA)'),
  ('gcc', 'Gulf Cooperation Council', 120, 'GCC bloc: Bahrain, Kuwait, Oman, Qatar, Saudi Arabia, UAE')
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name, sort_order = EXCLUDED.sort_order, description = EXCLUDED.description, updated_at = NOW();

-- Key countries - Europe
INSERT INTO kb_geography (code, name, sort_order, description) VALUES
  ('uk', 'United Kingdom', 200, 'UK-specific focus'),
  ('nl', 'Netherlands', 210, 'Netherlands-specific focus'),
  ('de', 'Germany', 220, 'Germany-specific focus'),
  ('fr', 'France', 230, 'France-specific focus'),
  ('ch', 'Switzerland', 240, 'Switzerland-specific focus'),
  ('ie', 'Ireland', 250, 'Ireland-specific focus')
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name, sort_order = EXCLUDED.sort_order, description = EXCLUDED.description, updated_at = NOW();

-- Key countries - Americas
INSERT INTO kb_geography (code, name, sort_order, description) VALUES
  ('us', 'United States', 300, 'US-specific focus'),
  ('ca', 'Canada', 310, 'Canada-specific focus'),
  ('br', 'Brazil', 320, 'Brazil-specific focus')
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name, sort_order = EXCLUDED.sort_order, description = EXCLUDED.description, updated_at = NOW();

-- Key countries - GCC / MENA
INSERT INTO kb_geography (code, name, sort_order, description) VALUES
  ('qa', 'Qatar', 400, 'Qatar-specific focus'),
  ('sa', 'Saudi Arabia', 410, 'Saudi Arabia-specific focus'),
  ('ae', 'United Arab Emirates', 420, 'UAE-specific focus'),
  ('kw', 'Kuwait', 430, 'Kuwait-specific focus'),
  ('om', 'Oman', 440, 'Oman-specific focus'),
  ('bh', 'Bahrain', 450, 'Bahrain-specific focus')
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name, sort_order = EXCLUDED.sort_order, description = EXCLUDED.description, updated_at = NOW();

-- Key countries - Asia-Pacific
INSERT INTO kb_geography (code, name, sort_order, description) VALUES
  ('in', 'India', 500, 'India-specific focus'),
  ('sg', 'Singapore', 510, 'Singapore-specific focus'),
  ('hk', 'Hong Kong', 520, 'Hong Kong-specific focus'),
  ('cn', 'China', 530, 'China-specific focus'),
  ('jp', 'Japan', 540, 'Japan-specific focus'),
  ('au', 'Australia', 550, 'Australia-specific focus')
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name, sort_order = EXCLUDED.sort_order, description = EXCLUDED.description, updated_at = NOW();

-- Fallback
INSERT INTO kb_geography (code, name, sort_order, description) VALUES
  ('other', 'Other / Unspecified', 900, 'Any other geography or unclear focus')
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name, sort_order = EXCLUDED.sort_order, description = EXCLUDED.description, updated_at = NOW();

-- Add comment
COMMENT ON TABLE kb_geography IS 'Geography taxonomy: Global → Macro-regions → Regional blocs → Countries. Publications can have multiple geography tags.';

-- Grant permissions
GRANT SELECT ON kb_geography TO anon, authenticated;
