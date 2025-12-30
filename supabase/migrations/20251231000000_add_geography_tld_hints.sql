-- KB-207: Document that geography codes can be used for TLD detection
-- No schema changes needed - just use existing 'code' column
-- The tagger will query kb_geography WHERE code = <tld> to check if a TLD matches a country

COMMENT ON TABLE kb_geography IS 
  'Geography taxonomy (continents, countries, regions). Country codes match TLDs for URL-based geography detection.';
