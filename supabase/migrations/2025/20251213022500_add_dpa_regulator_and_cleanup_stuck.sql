-- KB-219: Add DPA regulator and clean up stuck queue items
--
-- 1. Add Dutch DPA (Autoriteit Persoonsgegevens) to regulator table
-- 2. Mark items stuck at TO_THUMBNAIL (230) with thumbnails as ENRICHED (240)
-- 3. Mark items that have failed repeatedly (fetch_attempts >= 3) as FAILED

-- Add DPA regulator if not exists
INSERT INTO regulator (code, slug, name, jurisdiction, website)
VALUES (
  'dpa',
  'dpa',
  'Data Protection Authorities',
  'Global',
  'https://edpb.europa.eu'
)
ON CONFLICT (code) DO NOTHING;

-- Fix items stuck at TO_THUMBNAIL (230) that already have thumbnails -> move to PENDING_REVIEW (300)
UPDATE ingestion_queue
SET status_code = 300
WHERE status_code = 230
  AND payload->>'thumbnail_url' IS NOT NULL;

-- Mark items that have exceeded max fetch attempts as FAILED (500)
UPDATE ingestion_queue
SET 
  status_code = 500,
  rejection_reason = 'Failed after max fetch attempts'
WHERE status_code = 200
  AND (payload->>'fetch_attempts')::int >= 3;
