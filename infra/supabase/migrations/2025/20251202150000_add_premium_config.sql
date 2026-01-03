-- ============================================================================
-- KB-155: Add premium_config to kb_source
-- ============================================================================
-- Enables per-source configuration for premium content handling
-- ============================================================================

-- Add premium_config column (JSONB for flexibility)
ALTER TABLE kb_source 
ADD COLUMN IF NOT EXISTS premium_config JSONB;

-- Add comment
COMMENT ON COLUMN kb_source.premium_config IS 'Configuration for premium source handling: mode (headline_only, landing_page, manual_curation), selectors, etc.';

-- Set default config for existing premium sources
UPDATE kb_source 
SET premium_config = '{"mode": "headline_only", "extractPreview": true}'::jsonb
WHERE tier = 'premium' AND premium_config IS NULL;

-- Update consultancy sources to use landing_page mode
UPDATE kb_source 
SET premium_config = '{"mode": "landing_page", "selectors": {"title": "h1", "summary": ".article-summary, .excerpt"}}'::jsonb
WHERE slug IN ('mckinsey', 'bcg', 'bain') AND tier = 'premium';
