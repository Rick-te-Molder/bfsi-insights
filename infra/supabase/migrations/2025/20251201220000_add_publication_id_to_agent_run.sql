-- Add publication_id column to agent_run table
-- This allows tracking which publication an agent run relates to (for future post-approval agents)
-- KB-132

ALTER TABLE agent_run
ADD COLUMN IF NOT EXISTS publication_id uuid REFERENCES kb_publication(id) ON DELETE SET NULL;

-- Add index for lookups by publication
CREATE INDEX IF NOT EXISTS idx_agent_run_publication_id ON agent_run(publication_id);

COMMENT ON COLUMN agent_run.publication_id IS 'Optional reference to publication (for post-approval agents)';
