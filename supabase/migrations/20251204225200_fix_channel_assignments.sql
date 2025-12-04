-- KB-171: Fix channel assignments for consulting and media sources
-- 
-- Consulting firms publish research/analysis → academic_research
-- Media outlets report on markets → market_disclosures

-- Move consulting firms to academic_research (they publish thought leadership/research)
UPDATE kb_source SET channel_slug = 'academic_research' 
WHERE category = 'consulting';

-- Move media outlets to market_disclosures (they cover market news/analysis)
UPDATE kb_source SET channel_slug = 'market_disclosures' 
WHERE category = 'media_outlet';
