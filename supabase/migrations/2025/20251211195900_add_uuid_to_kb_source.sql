-- Migration: Add UUID id column to kb_source
-- Purpose: Add UUID primary key while keeping slug as unique identifier
-- This allows proper foreign key references from other tables

-- Step 1: Add UUID column with default
ALTER TABLE kb_source 
ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

-- Step 2: Populate existing rows with UUIDs
UPDATE kb_source SET id = gen_random_uuid() WHERE id IS NULL;

-- Step 3: Make id NOT NULL
ALTER TABLE kb_source ALTER COLUMN id SET NOT NULL;

-- Step 4: Add unique constraint on id (can't change PK without dropping all FKs)
ALTER TABLE kb_source ADD CONSTRAINT kb_source_id_unique UNIQUE (id);

-- Step 5: Create index on id for efficient lookups
CREATE INDEX IF NOT EXISTS idx_kb_source_id ON kb_source(id);

-- Comment
COMMENT ON COLUMN kb_source.id IS 'UUID identifier for foreign key references. slug remains the primary key for backwards compatibility.';
