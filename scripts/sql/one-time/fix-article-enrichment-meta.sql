-- Fix article that has v2.6 enrichment_meta but v2.5 tag data
-- This resets the tag enrichment_meta so the Re-run button becomes enabled

UPDATE ingestion_queue
SET payload = jsonb_set(
  payload,
  '{enrichment_meta,tag}',
  'null'::jsonb
)
WHERE id = '04ad39f3-2f57-4e5e-971b-6fc40d1f766a';

-- After running this, the Re-run button for Tag should be enabled
-- Then click Re-run to retag with v2.6
