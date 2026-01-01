-- KB-177: Switch Big 4 + Strategy 3 to Google News RSS feeds
-- Google News RSS handles crawling sites that block scrapers

-- PwC: Replace broken scraper with Google News RSS
UPDATE kb_source
SET 
  rss_feed = 'https://news.google.com/rss/search?q=site:pwc.com+banking+OR+insurance+OR+"financial+services"&hl=en-US&gl=US&ceid=US:en',
  scraper_config = NULL
WHERE name = 'PwC';

-- EY: Replace broken scraper with Google News RSS
UPDATE kb_source
SET 
  rss_feed = 'https://news.google.com/rss/search?q=site:ey.com+banking+OR+insurance+OR+"financial+services"&hl=en-US&gl=US&ceid=US:en',
  scraper_config = NULL
WHERE name = 'EY';

-- KPMG: Replace broken scraper with Google News RSS
UPDATE kb_source
SET 
  rss_feed = 'https://news.google.com/rss/search?q=site:kpmg.com+banking+OR+insurance+OR+"financial+services"&hl=en-US&gl=US&ceid=US:en',
  scraper_config = NULL
WHERE name = 'KPMG';

-- Deloitte: Replace broken scraper with Google News RSS
UPDATE kb_source
SET 
  rss_feed = 'https://news.google.com/rss/search?q=site:deloitte.com+banking+OR+insurance+OR+"financial+services"&hl=en-US&gl=US&ceid=US:en',
  scraper_config = NULL
WHERE name = 'Deloitte';

-- BCG: Update existing source with Google News RSS
UPDATE kb_source
SET 
  rss_feed = 'https://news.google.com/rss/search?q=site:bcg.com+banking+OR+insurance+OR+"financial+services"&hl=en-US&gl=US&ceid=US:en'
WHERE slug = 'bcg';

-- Bain: Update existing source with Google News RSS
UPDATE kb_source
SET 
  rss_feed = 'https://news.google.com/rss/search?q=site:bain.com+banking+OR+insurance+OR+"financial+services"&hl=en-US&gl=US&ceid=US:en'
WHERE name = 'Bain & Company';

-- Anthropic: RSS is 404, add scraper for /research page
UPDATE kb_source
SET 
  rss_feed = NULL,
  scraper_config = jsonb_build_object(
    'url', 'https://www.anthropic.com/research',
    'waitFor', '[class*="PublicationList"]',
    'waitMs', 3000,
    'selectors', jsonb_build_object(
      'article', '[class*="PublicationList"][class*="listItem"]',
      'title', '[class*="title"]',
      'link', 'a',
      'date', '[class*="date"]'
    )
  )
WHERE name = 'Anthropic';

-- SSRN: Keep RSS but add fallback note (blocked by 403)
-- For now, just leave as-is - may need proxy solution later
