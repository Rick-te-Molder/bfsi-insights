-- Migration: Add status code constraints and documentation
-- Run date: 2024-11-24
-- Purpose: Enforce valid status values with CHECK constraints

-- ============================================================================
-- STATUS CODE REFERENCE
-- ============================================================================
/*
ingestion_queue.status:
  - 'pending'    → Discovered, waiting for enrichment
  - 'enriched'   → AI has processed, ready for human review
  - 'approved'   → Human approved, moved to kb_publication
  - 'rejected'   → Human rejected, kept in queue for audit

kb_publication.status:
  - 'published'  → Live on website (default after approval)
  - 'draft'      → Created but not yet live (manual entries)
  - 'archived'   → Removed from public view but kept for history

Workflow:
  pending → enriched → approved (human) → published (auto)
                    ↘ rejected
*/

-- ============================================================================
-- ADD CHECK CONSTRAINTS
-- ============================================================================

-- Drop existing constraints if they exist (idempotent)
ALTER TABLE ingestion_queue 
DROP CONSTRAINT IF EXISTS ingestion_queue_status_check;

ALTER TABLE kb_publication 
DROP CONSTRAINT IF EXISTS kb_publication_status_check;

-- Add constraints for ingestion_queue
ALTER TABLE ingestion_queue
ADD CONSTRAINT ingestion_queue_status_check 
CHECK (status IN ('pending', 'enriched', 'approved', 'rejected'));

-- Add constraints for kb_publication
ALTER TABLE kb_publication
ADD CONSTRAINT kb_publication_status_check 
CHECK (status IN ('published', 'draft', 'archived'));

-- Add helpful comments
COMMENT ON COLUMN ingestion_queue.status IS 'Valid values: pending, enriched, approved, rejected. Enforced by CHECK constraint.';
COMMENT ON COLUMN kb_publication.status IS 'Valid values: published, draft, archived. Enforced by CHECK constraint.';
