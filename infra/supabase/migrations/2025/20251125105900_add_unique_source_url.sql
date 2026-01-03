-- Migration: Add UNIQUE constraint on kb_publication.source_url
-- Date: 2025-11-25
-- Purpose: Prevent duplicate publications from same source URL

-- First, find any existing duplicates
DO $$
DECLARE
  rec RECORD;
  dup_count INT := 0;
BEGIN
  FOR rec IN (
    SELECT 
      source_url,
      array_agg(slug ORDER BY date_added) as slugs,
      array_agg(id::text ORDER BY date_added) as ids
    FROM kb_publication
    WHERE status = 'published'
    GROUP BY source_url
    HAVING COUNT(*) > 1
  )
  LOOP
    dup_count := dup_count + 1;
    RAISE NOTICE 'Duplicate found for URL: %', rec.source_url;
    RAISE NOTICE '  Slugs (oldest first): %', rec.slugs;
    RAISE NOTICE '  IDs (oldest first): %', rec.ids;
    RAISE NOTICE '  → Keep first (oldest), delete others';
    RAISE NOTICE '';
  END LOOP;
  
  IF dup_count > 0 THEN
    RAISE EXCEPTION 'Found % duplicate source URLs. Please delete duplicates manually before adding UNIQUE constraint.', dup_count;
  ELSE
    RAISE NOTICE 'No duplicates found. Safe to add UNIQUE constraint.';
  END IF;
END $$;

-- Then add the UNIQUE constraint
CREATE UNIQUE INDEX idx_kb_publication_source_url_unique 
ON kb_publication(source_url);

-- Update comment
COMMENT ON COLUMN kb_publication.source_url IS 'Original source URL (normalized). Must be unique to prevent duplicates.';