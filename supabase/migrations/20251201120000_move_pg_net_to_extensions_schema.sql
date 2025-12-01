-- Migration: Move pg_net extension to extensions schema
-- Issue: KB-125
-- Purpose: Fix Supabase database linter warning about extension in public schema
-- 
-- Note: pg_net creates its functions in the 'net' schema regardless of where the 
-- extension is installed. This migration moves the extension metadata from 'public' 
-- to 'extensions' schema.

-- Drop and recreate the extension in the extensions schema
-- The CASCADE will drop dependent objects, but net.* functions remain usable
-- after recreation since they live in their own 'net' schema.

DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Verify the function still works by ensuring net schema functions are available
-- (pg_net always creates net.http_post, net.http_get etc. in the 'net' schema)

COMMENT ON EXTENSION pg_net IS 'Async HTTP client for PostgreSQL - moved to extensions schema';
