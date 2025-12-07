-- KB-177: Update Big 4 scraper configs with more robust selectors
-- These sites use complex SPAs that require longer wait times and flexible selectors

-- Deloitte: Use insights page with broader selectors
UPDATE kb_source
SET scraper_config = jsonb_build_object(
  'url', 'https://www2.deloitte.com/us/en/insights/industry/financial-services.html',
  'waitMs', 5000,
  'waitFor', 'article, [class*="promo"], [class*="card"]',
  'limit', 20,
  'selectors', jsonb_build_object(
    'article', 'article, [class*="promo-component"], [class*="card"], .content-block',
    'title', 'h2, h3, h4, [class*="title"], [class*="heading"]',
    'link', 'a[href*="/insights/"]',
    'description', 'p, [class*="description"], [class*="abstract"]',
    'date', '[class*="date"], time'
  )
)
WHERE slug = 'deloitte';

-- PwC: Use financial services publications page
UPDATE kb_source
SET scraper_config = jsonb_build_object(
  'url', 'https://www.pwc.com/gx/en/industries/financial-services/publications.html',
  'waitMs', 5000,
  'waitFor', '[class*="tile"], [class*="card"], article',
  'limit', 20,
  'selectors', jsonb_build_object(
    'article', '[class*="content-tile"], [class*="card"], article, .item',
    'title', 'h3, h4, [class*="title"], [class*="heading"]',
    'link', 'a',
    'description', 'p, [class*="description"], [class*="summary"]',
    'date', '[class*="date"], time, .date'
  )
)
WHERE slug = 'pwc';

-- EY: Use banking insights page with flexible selectors
UPDATE kb_source
SET scraper_config = jsonb_build_object(
  'url', 'https://www.ey.com/en_gl/insights/banking-capital-markets',
  'waitMs', 5000,
  'waitFor', '[class*="card"], article, [class*="promo"]',
  'limit', 20,
  'selectors', jsonb_build_object(
    'article', '[class*="ey-card"], [class*="card"], article, [class*="promo"]',
    'title', '[class*="title"], h2, h3, h4',
    'link', 'a',
    'description', '[class*="description"], [class*="summary"], p',
    'date', '[class*="date"], time'
  )
)
WHERE slug = 'ey';

-- KPMG: Use financial services insights page
UPDATE kb_source
SET scraper_config = jsonb_build_object(
  'url', 'https://kpmg.com/xx/en/home/insights/financial-services.html',
  'waitMs', 5000,
  'waitFor', '[class*="card"], article, [class*="promo"]',
  'limit', 20,
  'selectors', jsonb_build_object(
    'article', '[class*="kpmg-card"], [class*="card"], article, [class*="item"]',
    'title', 'h2, h3, h4, [class*="title"]',
    'link', 'a',
    'description', 'p, [class*="description"], [class*="summary"]',
    'date', '[class*="date"], time'
  )
)
WHERE slug = 'kpmg';

-- Also update the trusted sources list in discovery to match actual slugs
-- Note: This is tracked in discovery-relevance.js TRUSTED_SOURCES constant
