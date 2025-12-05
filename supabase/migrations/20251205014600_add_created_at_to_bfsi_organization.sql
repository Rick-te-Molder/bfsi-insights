-- Add created_at column to bfsi_organization for tracking when entities were added
ALTER TABLE bfsi_organization 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill existing rows with current timestamp (better than null)
UPDATE bfsi_organization 
SET created_at = NOW() 
WHERE created_at IS NULL;

-- Make it not null for future inserts
ALTER TABLE bfsi_organization 
ALTER COLUMN created_at SET NOT NULL;
