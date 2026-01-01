-- Fix sort_order to allow room for all EU countries (27+)
-- Current scheme: 100-109 for EU = only 9 slots
-- New scheme: sort within parent only, small numbers 1-100

-- L1: Global
UPDATE kb_geography SET sort_order = 1 WHERE code = 'global';

-- L2: Macro-regions (1-10 within L2)
UPDATE kb_geography SET sort_order = 1 WHERE code = 'emea';
UPDATE kb_geography SET sort_order = 2 WHERE code = 'apac';
UPDATE kb_geography SET sort_order = 3 WHERE code = 'amer';

-- L3: Sub-regions (1-10 within each L2 parent)
UPDATE kb_geography SET sort_order = 1 WHERE code = 'eu';
UPDATE kb_geography SET sort_order = 2 WHERE code = 'mena';
UPDATE kb_geography SET sort_order = 3 WHERE code = 'gcc';
UPDATE kb_geography SET sort_order = 4 WHERE code = 'africa';

-- L4: Countries (1-99 within each parent)
-- UK under emea directly
UPDATE kb_geography SET sort_order = 1 WHERE code = 'uk';

-- EU countries (1-99 available)
UPDATE kb_geography SET sort_order = 1 WHERE code = 'de';
UPDATE kb_geography SET sort_order = 2 WHERE code = 'fr';
UPDATE kb_geography SET sort_order = 3 WHERE code = 'nl';
UPDATE kb_geography SET sort_order = 4 WHERE code = 'ch';
UPDATE kb_geography SET sort_order = 5 WHERE code = 'ie';

-- GCC countries
UPDATE kb_geography SET sort_order = 1 WHERE code = 'ae';
UPDATE kb_geography SET sort_order = 2 WHERE code = 'sa';
UPDATE kb_geography SET sort_order = 3 WHERE code = 'qa';
UPDATE kb_geography SET sort_order = 4 WHERE code = 'kw';
UPDATE kb_geography SET sort_order = 5 WHERE code = 'om';
UPDATE kb_geography SET sort_order = 6 WHERE code = 'bh';

-- APAC countries
UPDATE kb_geography SET sort_order = 1 WHERE code = 'in';
UPDATE kb_geography SET sort_order = 2 WHERE code = 'sg';
UPDATE kb_geography SET sort_order = 3 WHERE code = 'hk';
UPDATE kb_geography SET sort_order = 4 WHERE code = 'cn';
UPDATE kb_geography SET sort_order = 5 WHERE code = 'jp';
UPDATE kb_geography SET sort_order = 6 WHERE code = 'au';

-- Americas countries
UPDATE kb_geography SET sort_order = 1 WHERE code = 'us';
UPDATE kb_geography SET sort_order = 2 WHERE code = 'ca';
UPDATE kb_geography SET sort_order = 3 WHERE code = 'br';

-- Other
UPDATE kb_geography SET sort_order = 99 WHERE code = 'other';

-- Query should use: ORDER BY level, parent_code, sort_order
