-- KB-171: Add industry_insights channel for consulting & media
-- 
-- Consulting firms and trade media produce commercial thought leadership,
-- not academic research or vendor product updates. They deserve their own channel.

-- Add new channel
INSERT INTO kb_channel (slug, name, description, icon, sort_order) VALUES
  ('industry_insights', 'Industry Insights', 
   'Thought leadership, market analysis, and industry trends from consulting firms and trade media', 
   '💡', 35)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order;

-- Move consulting firms to industry_insights
UPDATE kb_source SET channel_slug = 'industry_insights' 
WHERE category = 'consulting';

-- Move media outlets to industry_insights
UPDATE kb_source SET channel_slug = 'industry_insights' 
WHERE category = 'media_outlet';
