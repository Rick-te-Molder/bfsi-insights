-- ============================================================================
-- KB-118: Expand sources for better coverage
-- ============================================================================
-- Updates existing sources with RSS feeds and scraper configs
-- Adds new AI vendor sources
-- ============================================================================

-- Update BCG with RSS feed (exists as premium, keep tier)
UPDATE kb_source SET
  rss_feed = 'https://www.bcg.com/rss.xml',
  description = 'Global management consulting with deep financial services expertise',
  show_on_external_page = true
WHERE slug = 'bcg';

-- Update Bain with RSS feed
UPDATE kb_source SET
  rss_feed = 'https://www.bain.com/contentassets/sitecorefeeds/bainrss.xml',
  description = 'Management consulting focusing on strategy and performance improvement',
  show_on_external_page = true
WHERE slug = 'bain';

-- Update BIS with RSS feed
UPDATE kb_source SET
  rss_feed = 'https://www.bis.org/doclist/all_rss.htm',
  show_on_external_page = true
WHERE slug = 'bis';

-- Update SSRN with RSS feed (Banking & Finance category)
UPDATE kb_source SET
  rss_feed = 'https://papers.ssrn.com/sol3/Jeljour_results.cfm?form_name=journalbrowse&journal_id=1293&Network=no&lim=true&content_type=rss',
  description = 'Social Science Research Network - preprint repository for research papers',
  show_on_external_page = true
WHERE slug = 'ssrn';

-- Update Big 4 with scraper configs
UPDATE kb_source SET
  scraper_config = '{"url": "https://www2.deloitte.com/us/en/insights/industry/financial-services.html", "selectors": {"article": "article.promo-component", "title": "h3", "link": "a", "date": ".date"}}'::jsonb,
  show_on_external_page = true
WHERE slug = 'deloitte';

UPDATE kb_source SET
  scraper_config = '{"url": "https://www.pwc.com/gx/en/industries/financial-services/publications.html", "selectors": {"article": ".content-tile", "title": "h4", "link": "a", "date": ".date"}}'::jsonb,
  description = 'Professional services firm specializing in audit, tax, and consulting',
  show_on_external_page = true
WHERE slug = 'pwc';

UPDATE kb_source SET
  scraper_config = '{"url": "https://www.ey.com/en_gl/insights/financial-services", "selectors": {"article": ".ey-card", "title": ".ey-card__title", "link": "a", "date": ".date"}}'::jsonb,
  description = 'Multinational professional services partnership',
  show_on_external_page = true
WHERE slug = 'ey';

UPDATE kb_source SET
  scraper_config = '{"url": "https://kpmg.com/xx/en/home/insights/financial-services.html", "selectors": {"article": ".kpmg-card", "title": "h3", "link": "a", "date": ".date"}}'::jsonb,
  description = 'Global network of professional firms providing audit, tax, and advisory',
  show_on_external_page = true
WHERE slug = 'kpmg';

-- Update premium publications to show on external page
UPDATE kb_source SET
  description = 'Global business and financial news',
  show_on_external_page = true
WHERE slug = 'financial-times';

UPDATE kb_source SET
  description = 'International affairs, business, finance analysis',
  show_on_external_page = true
WHERE slug = 'the-economist';

UPDATE kb_source SET
  description = 'Dutch financial daily newspaper',
  show_on_external_page = true
WHERE slug = 'het-financieele-dagblad';

-- Update other regulators to show on external page
UPDATE kb_source SET show_on_external_page = true WHERE slug IN ('fed', 'imf', 'fsb', 'ecb');

-- Add new AI vendor sources
INSERT INTO kb_source (slug, name, domain, tier, category, description, enabled, show_on_external_page, sort_order, rss_feed)
VALUES 
  ('openai', 'OpenAI', 'openai.com', 'standard', 'vendor',
   'AI research company behind GPT models and ChatGPT',
   true, true, 300, 'https://openai.com/blog/rss.xml'),
  ('anthropic', 'Anthropic', 'anthropic.com', 'standard', 'vendor',
   'AI safety company building Claude AI assistant',
   true, true, 301, 'https://www.anthropic.com/rss.xml'),
  ('aws-ml', 'AWS Machine Learning Blog', 'aws.amazon.com', 'standard', 'vendor',
   'Amazon Web Services machine learning and AI insights',
   true, true, 302, 'https://aws.amazon.com/blogs/machine-learning/feed/'),
  ('google-ai', 'Google AI Blog', 'blog.google', 'standard', 'vendor',
   'Google AI research and product updates',
   true, true, 303, 'https://blog.google/technology/ai/rss/'),
  ('microsoft-ai', 'Microsoft AI Blog', 'blogs.microsoft.com', 'standard', 'vendor',
   'Microsoft Azure AI and Copilot updates',
   true, true, 304, 'https://blogs.microsoft.com/ai/feed/')
ON CONFLICT (slug) DO UPDATE SET
  rss_feed = EXCLUDED.rss_feed,
  description = EXCLUDED.description,
  show_on_external_page = EXCLUDED.show_on_external_page;
