-- KB-171: Add kb_category lookup table for dynamic category dropdowns
-- 
-- Categories are currently enforced by a CHECK constraint, but we need
-- a lookup table to populate UI dropdowns dynamically.

CREATE TABLE IF NOT EXISTS kb_category (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 100
);

COMMENT ON TABLE kb_category IS 'Source category lookup for UI dropdowns';

-- Seed categories (matching the CHECK constraint values)
INSERT INTO kb_category (slug, name, description, sort_order) VALUES
  ('regulator', 'Regulator', 'Supervisory authorities (EBA, ESMA, AFM, FCA)', 10),
  ('central_bank', 'Central Bank', 'Central banks (ECB, Fed, DNB)', 20),
  ('standards_body', 'Standards Body', 'NIST, ISO, BCBS, FATF, W3C', 30),
  ('government_body', 'Government Body', 'Government agencies (non-regulatory)', 40),
  ('research', 'Research', 'Research organizations, think tanks', 50),
  ('academic', 'Academic', 'Universities, academic publishers', 60),
  ('consulting', 'Consulting', 'Big 4, strategy consulting firms', 70),
  ('media_outlet', 'Media Outlet', 'News, trade publications', 80),
  ('vendor', 'Vendor', 'Technology vendors (BFSI and AI/agentic)', 90)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

-- RLS
ALTER TABLE kb_category ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categories are publicly readable" ON kb_category FOR SELECT USING (true);
