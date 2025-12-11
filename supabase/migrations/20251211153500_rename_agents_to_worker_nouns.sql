-- KB-211: Rename agents to consistent "worker noun" naming convention
-- See docs/agents/manifest.yaml for full naming convention

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
DELETE FROM prompt_versions WHERE agent_name = 'discovery-relevance-config';
DELETE FROM prompt_versions WHERE agent_name = 'discovery-rss';
DELETE FROM prompt_versions WHERE agent_name = 'enrichment-bfsi';

-- Add comment for documentation
COMMENT ON TABLE prompt_versions IS 'Prompt versions for agents. Agent names use worker noun convention: scorer, screener, summarizer, tagger, thumbnailer. See docs/agents/manifest.yaml.';
