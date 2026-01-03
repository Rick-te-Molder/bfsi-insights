-- KB-221: Remove publications with broken links (detected by nightly link checker)
--
-- Broken URLs:
-- 1. McKinsey insights (Medium) - HTTP 403 (blocked) - in kb_publication
-- 2. Banken zetten in op ai-agenten - HTTP 500 - in ingestion_queue (approved but not published)

-- Remove from kb_publication
DELETE FROM kb_publication
WHERE slug = '5-mckinsey-insights-on-how-agentic-ai-is-reshaping-industries';

-- Mark as FAILED in ingestion_queue (was approved but source is broken)
UPDATE ingestion_queue
SET status_code = 500,
    rejection_reason = 'Source URL returns HTTP 500 - detected by nightly link checker'
WHERE id = '2c6e350c-5d37-499c-a1c5-cc380b4de9bd';
