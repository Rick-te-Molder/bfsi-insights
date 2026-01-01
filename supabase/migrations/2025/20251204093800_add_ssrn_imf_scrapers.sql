-- ============================================================================
-- Add scraper fallbacks for SSRN and IMF
-- ============================================================================
-- These sources have unreliable RSS feeds (403/timeout errors).
-- Adding scraper configs as fallback when RSS fails.
-- ============================================================================

-- SSRN: Banking & Finance papers page
-- RSS often returns 403, scraper provides fallback
UPDATE kb_source SET
  scraper_config = '{
    "url": "https://papers.ssrn.com/sol3/JELJOUR_Results.cfm?form_name=journalbrowse&journal_id=1293",
    "waitFor": ".title",
    "limit": 20,
    "selectors": {
      "article": ".paper-result, .result-item",
      "title": ".title a, h3 a",
      "link": ".title a, h3 a",
      "date": ".date, .submission-date"
    }
  }'::jsonb
WHERE slug = 'ssrn';

-- IMF: Publications page for working papers
-- RSS often times out, scraper provides fallback
UPDATE kb_source SET
  scraper_config = '{
    "url": "https://www.imf.org/en/Publications/Search?series=IMF+Working+Papers",
    "waitFor": ".result-item",
    "limit": 20,
    "selectors": {
      "article": ".result-item, .pub-row",
      "title": "h3 a, .title a",
      "link": "h3 a, .title a", 
      "date": ".date, time"
    }
  }'::jsonb
WHERE slug = 'imf';

-- Add comment for documentation
COMMENT ON COLUMN kb_source.scraper_config IS 'Fallback scraper configuration when RSS fails. Fields: url, waitFor (CSS selector), limit, selectors (article, title, link, date)';
