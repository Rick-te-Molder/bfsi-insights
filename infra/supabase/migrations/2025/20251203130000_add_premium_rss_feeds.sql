-- Add RSS feeds for premium sources (regulators)
-- These are official RSS feeds from the source websites

-- ECB: Publications RSS
UPDATE kb_source 
SET rss_feed = 'https://www.ecb.europa.eu/rss/pub.html'
WHERE slug = 'ecb';

-- Federal Reserve: FEDS Notes (financial research)
UPDATE kb_source 
SET rss_feed = 'https://www.federalreserve.gov/feeds/feds_notes.xml'
WHERE slug = 'fed';

-- BIS: BIS and FSI publications
UPDATE kb_source 
SET rss_feed = 'https://www.bis.org/doclist/bis_fsi_publs.rss'
WHERE slug = 'bis';
