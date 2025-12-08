-- KB-180: Strip redundant source suffix from publication titles
-- Handles mismatches like: title "| FDIC.gov" vs source_name "www.fdic.gov"
-- Also decodes common HTML entities in titles

-- Decode HTML entities in titles
-- Using E'' syntax for special characters
UPDATE kb_publication
SET title = REPLACE(
  REPLACE(
    REPLACE(
      REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(
              REPLACE(title, '&#x2019;', E'\u2019'),
              '&#x2018;', E'\u2018'
            ),
            '&#x201C;', E'\u201C'
          ),
          '&#x201D;', E'\u201D'
        ),
        '&#8211;', E'\u2013'
      ),
      '&#8212;', E'\u2014'
    ),
    '&amp;', '&'
  ),
  '&nbsp;', ' '
)
WHERE title ~ '&#x?[0-9A-Fa-f]+;|&(amp|nbsp);';

-- Helper function to extract domain/org name for comparison
CREATE OR REPLACE FUNCTION pg_temp.normalize_source(s TEXT) RETURNS TEXT AS $$
BEGIN
  -- Remove www. prefix and common suffixes for comparison
  RETURN LOWER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(s, '^www\.', ''),
      '\.(com|org|gov|co\.uk|nl|sg)$', ''
    )
  );
END;
$$ LANGUAGE plpgsql;

-- Strip suffix after " | " if it looks like a source reference
UPDATE kb_publication
SET title = TRIM(LEFT(title, LENGTH(title) - LENGTH(SUBSTRING(title FROM ' \| [^|]+$'))))
WHERE title ~ ' \| [^|]+$'
  AND (
    -- Suffix ends with domain extension
    title ~ ' \| [^|]+\.(com|org|gov|co\.uk|nl|sg|io)$'
    -- OR suffix matches normalized source_name
    OR pg_temp.normalize_source(SUBSTRING(title FROM ' \| ([^|]+)$')) 
       = pg_temp.normalize_source(source_name)
    -- OR suffix is a known short name
    OR SUBSTRING(title FROM ' \| ([^|]+)$') IN (
      'McKinsey', 'OpenAI', 'FCA', 'PRA', 'ECB', 'Fed', 'FDIC', 
      'FinCEN', 'OCC', 'SEC', 'CFTC', 'FINRA', 'Basel', 'BIS',
      'Bank of England', 'De Nederlandsche Bank', 'Microsoft Azure Blog',
      'Fintech Singapore', 'PYMNTS.com', 'FDIC.gov', 'FinCEN.gov'
    )
  );

-- Strip suffix after " - " for domain-like suffixes only (more conservative)
UPDATE kb_publication
SET title = TRIM(LEFT(title, LENGTH(title) - LENGTH(SUBSTRING(title FROM ' - [^-]+$'))))
WHERE title ~ ' - [^-]+$'
  AND (
    -- Suffix is exactly "Fintech Singapore" or similar known patterns
    SUBSTRING(title FROM ' - ([^-]+)$') IN (
      'Fintech Singapore', 'Executive Summary', 'Full Report'
    )
  );

-- Log results
DO $$
BEGIN
  RAISE NOTICE 'KB-180: Source suffix stripping migration complete';
END $$;
