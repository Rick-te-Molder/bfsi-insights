-- KB-221: Remove publications with broken links (detected by nightly link checker)
--
-- These source URLs are no longer accessible:
-- 1. McKinsey insights (Medium) - HTTP 403 (blocked)
-- Note: "Banken zetten in op ai-agenten" not in kb_publication (likely still in queue or rejected)

DELETE FROM kb_publication
WHERE slug = '5-mckinsey-insights-on-how-agentic-ai-is-reshaping-industries';
