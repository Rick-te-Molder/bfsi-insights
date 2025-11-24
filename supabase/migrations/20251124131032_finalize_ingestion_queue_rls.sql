-- Migration: Finalize ingestion_queue RLS policies
-- Run date: 2024-11-24
-- Purpose: Document working RLS configuration for review workflow

-- Disable RLS for authenticated users (admin-only table)
-- Security is handled by auth.getSession() check in UI
ALTER TABLE ingestion_queue DISABLE ROW LEVEL SECURITY;

-- Keep service_role policy for scripts
DROP POLICY IF EXISTS "ingestion_queue_service_all" ON ingestion_queue;
CREATE POLICY "ingestion_queue_service_all"
ON ingestion_queue
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Document decision
COMMENT ON TABLE ingestion_queue IS 'Admin-only review queue. RLS disabled since access is controlled by application-level auth.';
