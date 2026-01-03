-- KB-180: Strip source PREFIX from publication titles
-- Handles patterns like "The Fed - Actual Title" → "Actual Title"

-- Strip "The Fed - " prefix
UPDATE kb_publication
SET title = TRIM(SUBSTRING(title FROM 11))
WHERE title LIKE 'The Fed - %';

-- Strip "The Fed – " prefix (en dash)
UPDATE kb_publication
SET title = TRIM(SUBSTRING(title FROM 11))
WHERE title LIKE E'The Fed \u2013 %';

-- Strip "The Fed — " prefix (em dash)
UPDATE kb_publication
SET title = TRIM(SUBSTRING(title FROM 11))
WHERE title LIKE E'The Fed \u2014 %';

-- Generic: Strip "SOURCE | " or "SOURCE - " prefix for known sources
-- Only if the prefix matches a known pattern
UPDATE kb_publication
SET title = TRIM(REGEXP_REPLACE(title, '^(FDIC|FCA|ECB|OCC|SEC|FinCEN|BIS|PRA|Fed) [-–—|:] ', ''))
WHERE title ~ '^(FDIC|FCA|ECB|OCC|SEC|FinCEN|BIS|PRA|Fed) [-–—|:] ';

-- Log results
DO $$
BEGIN
  RAISE NOTICE 'KB-180: Source prefix stripping migration complete';
END $$;
