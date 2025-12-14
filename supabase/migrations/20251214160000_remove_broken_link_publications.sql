-- KB-221: Remove publications with broken links (detected by nightly link checker)
--
-- These source URLs are no longer accessible:
-- 1. McKinsey 2025 AI Report - HTTP 403 (Medium blocked)
-- 2. Banken zetten in op ai-agenten - HTTP 500 (server error)

DELETE FROM publication
WHERE slug IN (
  'mckinsey-2025-ai-report-key-findings-1765550658203',
  'banken-zetten-in-op-ai-agenten-maar-echte-doorbraak-blijft-uit'
);
