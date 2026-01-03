-- Add structured summary column for v2 summarizer output
-- Stores: authors with credentials, key_insights, bfsi_relevance, entities, key_figures

ALTER TABLE kb_publication 
ADD COLUMN IF NOT EXISTS summary_structured JSONB;

COMMENT ON COLUMN kb_publication.summary_structured IS 'Structured summary data from summarizer v2: authors, key_insights, bfsi_relevance, entities, key_figures';

-- Also add to the pretty view if it exists
-- (view will need to be recreated to include new column)
