-- KB-211: Rename agents to consistent "worker noun" naming convention
-- See docs/agents/manifest.yaml for full naming convention

-- First, delete rejection_analytics referencing old versions (FK constraint)
DELETE FROM rejection_analytics WHERE prompt_version IN (
  SELECT version FROM prompt_versions WHERE agent_name IN (
    'relevance-filter', 'content-summarizer', 'taxonomy-tagger', 
    'thumbnail-generator', 'discovery-relevance', 
    'discovery-relevance-config', 'discovery-rss', 'enrichment-bfsi'
  )
);

-- Rename agent_name in prompt_versions
UPDATE prompt_versions SET agent_name = 'screener' WHERE agent_name = 'relevance-filter';
UPDATE prompt_versions SET agent_name = 'summarizer' WHERE agent_name = 'content-summarizer';
UPDATE prompt_versions SET agent_name = 'tagger' WHERE agent_name = 'taxonomy-tagger';
UPDATE prompt_versions SET agent_name = 'thumbnailer' WHERE agent_name = 'thumbnail-generator';
UPDATE prompt_versions SET agent_name = 'scorer' WHERE agent_name = 'discovery-relevance';

-- Rename agent_name in eval_golden_set
UPDATE eval_golden_set SET agent_name = 'screener' WHERE agent_name = 'relevance-filter';
UPDATE eval_golden_set SET agent_name = 'scorer' WHERE agent_name = 'discovery-relevance';

-- Delete legacy/unused entries
DELETE FROM prompt_versions WHERE agent_name IN ('discovery-relevance-config', 'discovery-rss', 'enrichment-bfsi');

-- Add comment for documentation
COMMENT ON TABLE prompt_versions IS 'Prompt versions for agents. Agent names use worker noun convention: scorer, screener, summarizer, tagger, thumbnailer. See docs/agents/manifest.yaml.';
