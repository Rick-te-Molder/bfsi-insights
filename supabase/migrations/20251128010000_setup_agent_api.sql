-- 1. Update ingestion_queue status constraint
ALTER TABLE ingestion_queue DROP CONSTRAINT IF EXISTS ingestion_queue_status_check;

ALTER TABLE ingestion_queue ADD CONSTRAINT ingestion_queue_status_check
CHECK (status IN (
  'pending',    -- Initial state
  'fetched',    -- Content retrieved
  'filtered',   -- Passed relevance check
  'summarized', -- Content summarized (Ready for tagging)
  'enriched',   -- Tagged & Ready for approval
  'approved',   -- Published
  'rejected'    -- Irrelevant/Error
));

-- 2. Seed Initial Prompts (simplified for now)
-- We assume prompt_versions table exists (based on your screenshot)

-- Relevance Filter
INSERT INTO prompt_versions (agent_name, version, prompt_text, model_id, stage, is_current, created_at)
VALUES (
  'relevance-filter',
  'filter-v1.0',
  'You are a BFSI content filter. Analyze the Title and Description. Respond JSON: { "relevant": boolean, "reason": string }. Criteria: Must be related to Banking, Financial Services, or Insurance.',
  'gpt-4o-mini',
  'filter',
  true,
  now()
);

-- Summarizer
INSERT INTO prompt_versions (agent_name, version, prompt_text, model_id, stage, is_current, created_at)
VALUES (
  'content-summarizer',
  'summarizer-v1.0',
  'You are an expert BFSI analyst. Summarize the following content for executives. Output JSON: { "title": string, "summary": { "short": string, "medium": string, "long": string }, "key_takeaways": string[] }.',
  'gpt-4o',
  'summarize',
  true,
  now()
);

-- Tagger
INSERT INTO prompt_versions (agent_name, version, prompt_text, model_id, stage, is_current, created_at)
VALUES (
  'taxonomy-tagger',
  'tagger-v1.0',
  'Classify this article into ONE Industry and ONE Topic based on the provided Summary. Output JSON: { "industry_code": string, "topic_code": string, "confidence": number, "reasoning": string }.',
  'gpt-4o-mini',
  'tag',
  true,
  now()
);