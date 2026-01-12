-- Migration: Add transitions that skip intermediate "completed" states
-- The orchestrator code (enrichment-steps.js) goes directly from "in-progress"
-- to "next step ready" states, skipping the "completed" intermediates.
-- E.g., stepSummarize: 211 (summarizing) → 220 (to_tag), skipping 212 (summarized)

-- Add skip-intermediate transitions for enrichment flow
INSERT INTO public.state_transitions (from_status, to_status, is_manual, description)
SELECT from_status, to_status, false, description
FROM (VALUES
  (211, 220, 'summarizing → to_tag (skip summarized)'),
  (221, 230, 'tagging → to_thumbnail (skip tagged)'),
  (221, 240, 'tagging → enriched (skip tagged, no thumbnail)'),
  (221, 300, 'tagging → pending_review (skip tagged, no thumbnail)'),
  (231, 240, 'thumbnailing → enriched (skip thumbnailed)'),
  (231, 300, 'thumbnailing → pending_review (skip thumbnailed)')
) AS t(from_status, to_status, description)
WHERE EXISTS (SELECT 1 FROM public.status_lookup WHERE code = t.from_status)
  AND EXISTS (SELECT 1 FROM public.status_lookup WHERE code = t.to_status)
ON CONFLICT (from_status, to_status, is_manual) DO NOTHING;
