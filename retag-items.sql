-- Move the 3 items in status 300 back to status 220 (to_tag) for re-enrichment
-- This will trigger the tagger to run with the new dynamic audience schema

UPDATE ingestion_queue
SET status_code = 220
WHERE id IN (
  'df2eab69-f835-488a-9567-90bdfb091cd3',  -- AI Agent Team Automates Development Tasks
  '3b11a7a1-9ea4-4589-a565-cfdc3469a40d',  -- 9 RAG Architectures Every AI Developer Must Know
  'e8a8ea11-d789-4cdd-b42a-1946745cb092'   -- Building the 7 Layers of a Production-Grade Agentic AI System
);

-- Verify the update
SELECT id, payload->>'title' as title, status_code
FROM ingestion_queue
WHERE id IN (
  'df2eab69-f835-488a-9567-90bdfb091cd3',
  '3b11a7a1-9ea4-4589-a565-cfdc3469a40d',
  'e8a8ea11-d789-4cdd-b42a-1946745cb092'
);
