-- KB-277: Backfill missed_discovery rows that don't have a queue_id
-- These were added before KB-277 introduced the auto-queue feature

-- For each missed_discovery without a queue_id, create an ingestion_queue entry
-- and link them together

DO $$
DECLARE
  rec RECORD;
  new_queue_id UUID;
BEGIN
  FOR rec IN 
    SELECT id, url, source_domain, submitter_name, why_valuable
    FROM missed_discovery 
    WHERE queue_id IS NULL 
      AND resolution_status = 'pending'
  LOOP
    -- Insert into ingestion_queue
    INSERT INTO ingestion_queue (url, status_code, entry_type, payload)
    VALUES (
      rec.url,
      200, -- pending_enrichment
      'manual',
      jsonb_build_object(
        'manual_add', true,
        'submitter', rec.submitter_name,
        'why_valuable', rec.why_valuable,
        'backfilled', true
      )
    )
    RETURNING id INTO new_queue_id;

    -- Update missed_discovery with the queue_id
    UPDATE missed_discovery
    SET queue_id = new_queue_id
    WHERE id = rec.id;

    RAISE NOTICE 'Backfilled missed_discovery % -> queue %', rec.id, new_queue_id;
  END LOOP;
END $$;
