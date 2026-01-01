-- ============================================================================
-- KB-131: Add sitemap support to kb_source
-- ============================================================================
-- Enables sitemap-based discovery as an alternative to RSS/scraping
-- ============================================================================

-- Add sitemap_url column
ALTER TABLE kb_source 
ADD COLUMN IF NOT EXISTS sitemap_url TEXT;

-- Add comment
COMMENT ON COLUMN kb_source.sitemap_url IS 'URL to XML sitemap for article discovery (alternative to RSS)';

-- Update the query filter to include sitemap sources
-- (This is informational - the actual query is in discover.js)
COMMENT ON TABLE kb_source IS 'Content sources with RSS, sitemap, or scraper configuration for discovery';
