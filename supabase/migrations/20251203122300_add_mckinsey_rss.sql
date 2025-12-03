-- Add RSS feed for McKinsey (they have a working general insights RSS)
-- The discovery agent's keyword scoring will filter for BFSI-relevant content

UPDATE kb_source 
SET rss_feed = 'https://www.mckinsey.com/insights/rss'
WHERE slug = 'mckinsey';
