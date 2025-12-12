-- Backfill thumbnail_bucket and thumbnail_path for existing publications
-- Matches kb_publication.source_url with ingestion_queue.url to get the stored thumbnail info

UPDATE kb_publication p
SET 
  thumbnail_bucket = (q.payload->>'thumbnail_bucket')::text,
  thumbnail_path = (q.payload->>'thumbnail_path')::text
FROM ingestion_queue q
WHERE p.source_url = q.url
  AND p.thumbnail_bucket IS NULL
  AND p.thumbnail_path IS NULL
  AND q.payload->>'thumbnail_bucket' IS NOT NULL
  AND q.payload->>'thumbnail_path' IS NOT NULL;
