-- Add TLD hint column to kb_geography for dynamic country detection
-- KB-207: Move hardcoded TLD mappings from tagger.js to database

ALTER TABLE kb_geography ADD COLUMN IF NOT EXISTS tld_hint text;

COMMENT ON COLUMN kb_geography.tld_hint IS 
  'Top-level domain hint for this geography (e.g., "nl" for Netherlands). Used by tagger to infer geography from source URL.';

-- Update existing country codes with their TLD hints
UPDATE kb_geography SET tld_hint = 'nl' WHERE code = 'nl';
UPDATE kb_geography SET tld_hint = 'de' WHERE code = 'de';
UPDATE kb_geography SET tld_hint = 'fr' WHERE code = 'fr';
UPDATE kb_geography SET tld_hint = 'uk' WHERE code = 'uk';
UPDATE kb_geography SET tld_hint = 'us' WHERE code = 'us';
UPDATE kb_geography SET tld_hint = 'ca' WHERE code = 'ca';
UPDATE kb_geography SET tld_hint = 'au' WHERE code = 'au';
UPDATE kb_geography SET tld_hint = 'sg' WHERE code = 'sg';
UPDATE kb_geography SET tld_hint = 'hk' WHERE code = 'hk';
UPDATE kb_geography SET tld_hint = 'jp' WHERE code = 'jp';
UPDATE kb_geography SET tld_hint = 'ch' WHERE code = 'ch';
UPDATE kb_geography SET tld_hint = 'ie' WHERE code = 'ie';
UPDATE kb_geography SET tld_hint = 'in' WHERE code = 'in';
UPDATE kb_geography SET tld_hint = 'ae' WHERE code = 'ae';
UPDATE kb_geography SET tld_hint = 'sa' WHERE code = 'sa';
UPDATE kb_geography SET tld_hint = 'qa' WHERE code = 'qa';
UPDATE kb_geography SET tld_hint = 'kw' WHERE code = 'kw';
UPDATE kb_geography SET tld_hint = 'bh' WHERE code = 'bh';
UPDATE kb_geography SET tld_hint = 'om' WHERE code = 'om';
UPDATE kb_geography SET tld_hint = 'br' WHERE code = 'br';
UPDATE kb_geography SET tld_hint = 'cn' WHERE code = 'cn';
