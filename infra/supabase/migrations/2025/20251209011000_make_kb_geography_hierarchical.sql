-- KB-192: Make kb_geography hierarchical like bfsi_industry
-- Adds level and parent_code columns for proper hierarchy:
-- L1: global
-- L2: emea, apac, amer (macro-regions)
-- L3: eu, mena, gcc, africa (sub-regions under EMEA)
-- L4: countries

-- Step 1: Add hierarchy columns
ALTER TABLE kb_geography 
ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 4,
ADD COLUMN IF NOT EXISTS parent_code TEXT;

-- Step 2: Update hierarchy levels and parent codes

-- L1: Global (no parent)
UPDATE kb_geography SET level = 1, parent_code = NULL WHERE code = 'global';

-- L2: Macro-regions (parent: global)
UPDATE kb_geography SET level = 2, parent_code = 'global' WHERE code IN ('emea', 'apac', 'amer');

-- L3: Sub-regions
UPDATE kb_geography SET level = 3, parent_code = 'emea' WHERE code IN ('eu', 'mena', 'gcc', 'africa');

-- L4: European countries (parent: eu)
UPDATE kb_geography SET level = 4, parent_code = 'eu' WHERE code IN ('de', 'fr', 'nl', 'ch', 'ie');

-- L4: UK is under emea but not eu
UPDATE kb_geography SET level = 4, parent_code = 'emea' WHERE code = 'uk';

-- L4: Americas countries (parent: amer)
UPDATE kb_geography SET level = 4, parent_code = 'amer' WHERE code IN ('us', 'ca', 'br');

-- L4: GCC countries (parent: gcc)
UPDATE kb_geography SET level = 4, parent_code = 'gcc' WHERE code IN ('qa', 'sa', 'ae', 'kw', 'om', 'bh');

-- L4: APAC countries (parent: apac)
UPDATE kb_geography SET level = 4, parent_code = 'apac' WHERE code IN ('in', 'sg', 'hk', 'cn', 'jp', 'au');

-- L4: Other/fallback (parent: global)
UPDATE kb_geography SET level = 4, parent_code = 'global' WHERE code = 'other';

-- Step 3: Add foreign key constraint (self-referencing)
-- Note: Can't add FK on text column referencing itself easily, 
-- so we rely on application-level validation (same as bfsi_industry)

-- Step 4: Update sort_order to reflect hierarchy properly
UPDATE kb_geography SET sort_order = 1 WHERE code = 'global';

UPDATE kb_geography SET sort_order = 10 WHERE code = 'emea';
UPDATE kb_geography SET sort_order = 20 WHERE code = 'apac';
UPDATE kb_geography SET sort_order = 30 WHERE code = 'amer';

UPDATE kb_geography SET sort_order = 100 WHERE code = 'eu';
UPDATE kb_geography SET sort_order = 110 WHERE code = 'mena';
UPDATE kb_geography SET sort_order = 120 WHERE code = 'gcc';
UPDATE kb_geography SET sort_order = 130 WHERE code = 'africa';

-- European countries (101-109)
UPDATE kb_geography SET sort_order = 101 WHERE code = 'uk';
UPDATE kb_geography SET sort_order = 102 WHERE code = 'de';
UPDATE kb_geography SET sort_order = 103 WHERE code = 'fr';
UPDATE kb_geography SET sort_order = 104 WHERE code = 'nl';
UPDATE kb_geography SET sort_order = 105 WHERE code = 'ch';
UPDATE kb_geography SET sort_order = 106 WHERE code = 'ie';

-- GCC countries (121-126)
UPDATE kb_geography SET sort_order = 121 WHERE code = 'ae';
UPDATE kb_geography SET sort_order = 122 WHERE code = 'sa';
UPDATE kb_geography SET sort_order = 123 WHERE code = 'qa';
UPDATE kb_geography SET sort_order = 124 WHERE code = 'kw';
UPDATE kb_geography SET sort_order = 125 WHERE code = 'om';
UPDATE kb_geography SET sort_order = 126 WHERE code = 'bh';

-- APAC countries (201-210)
UPDATE kb_geography SET sort_order = 201 WHERE code = 'in';
UPDATE kb_geography SET sort_order = 202 WHERE code = 'sg';
UPDATE kb_geography SET sort_order = 203 WHERE code = 'hk';
UPDATE kb_geography SET sort_order = 204 WHERE code = 'cn';
UPDATE kb_geography SET sort_order = 205 WHERE code = 'jp';
UPDATE kb_geography SET sort_order = 206 WHERE code = 'au';

-- Americas countries (301-310)
UPDATE kb_geography SET sort_order = 301 WHERE code = 'us';
UPDATE kb_geography SET sort_order = 302 WHERE code = 'ca';
UPDATE kb_geography SET sort_order = 303 WHERE code = 'br';

-- Other/fallback
UPDATE kb_geography SET sort_order = 999 WHERE code = 'other';

-- Step 5: Create index for hierarchy queries
CREATE INDEX IF NOT EXISTS idx_kb_geography_parent ON kb_geography(parent_code);
CREATE INDEX IF NOT EXISTS idx_kb_geography_level ON kb_geography(level);
