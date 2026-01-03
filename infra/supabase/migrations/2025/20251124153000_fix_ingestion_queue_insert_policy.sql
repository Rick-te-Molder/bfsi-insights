-- Migration: Fix ingestion_queue insert policy for authenticated users
-- Date: 2024-11-24
-- Purpose: Allow authenticated users to add URLs via admin interface

-- Ensure RLS is enabled
ALTER TABLE ingestion_queue ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "ingestion_queue_authenticated_all" ON ingestion_queue;
DROP POLICY IF EXISTS "ingestion_queue_service_all" ON ingestion_queue;

-- Allow authenticated users full access (admin-only table)
CREATE POLICY "ingestion_queue_authenticated_all"
ON ingestion_queue
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Keep service_role policy for scripts
CREATE POLICY "ingestion_queue_service_all"
ON ingestion_queue
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Add comment
COMMENT ON TABLE ingestion_queue IS 'Admin-only review queue. Authenticated users have full access via RLS.';