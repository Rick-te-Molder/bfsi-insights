-- Add scraper configs for consultancies without RSS feeds
-- Uses extended scraper config with waitFor, limit, etc.

-- BCG: Financial Institutions insights page
UPDATE kb_source SET
  scraper_config = '{
    "url": "https://www.bcg.com/industries/financial-institutions/insights",
    "waitFor": "[class*=''card'']",
    "waitMs": 3000,
    "limit": 20,
    "selectors": {
      "article": "[class*=''card''], [class*=''Card'']",
      "title": "h3, h4, h5, [class*=''title'']",
      "link": "a",
      "description": "p, [class*=''description'']"
    }
  }'::jsonb
WHERE slug = 'bcg';

-- Bain: Financial Services insights page  
UPDATE kb_source SET
  scraper_config = '{
    "url": "https://www.bain.com/insights/industry-insights/financial-services-insights/",
    "waitFor": "[class*=''card'']",
    "waitMs": 3000,
    "limit": 20,
    "selectors": {
      "article": "[class*=''card''], [class*=''Card''], article",
      "title": "h3, h4, [class*=''title'']",
      "link": "a",
      "description": "p, [class*=''description''], [class*=''excerpt'']"
    }
  }'::jsonb
WHERE slug = 'bain';
