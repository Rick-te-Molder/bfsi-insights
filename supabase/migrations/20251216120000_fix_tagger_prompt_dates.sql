-- ============================================================================
-- KB-258: Fix tagger prompt created_at dates
-- Root cause: Migrations used UPDATE instead of INSERT, keeping original dates
-- Fix: Set created_at based on migration file timestamps
-- ============================================================================

-- tagger-v2.0 was created in migration 20251208120000
UPDATE prompt_version 
SET created_at = '2025-12-08 12:00:00+00'
WHERE agent_name = 'tagger' AND version = 'tagger-v2.0';

-- tagger-v2.1 was created in migration 20251208220000
UPDATE prompt_version 
SET created_at = '2025-12-08 22:00:00+00'
WHERE agent_name = 'tagger' AND version = 'tagger-v2.1';
