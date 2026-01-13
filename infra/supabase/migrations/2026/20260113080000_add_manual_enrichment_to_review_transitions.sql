-- Migration: Add manual transitions from enrichment statuses to pending_review
-- Fixes: Single-step re-enrichment for items stuck at intermediate statuses
-- When an item is stuck at 210, 211, 220, 221, 230, 231, or 240, we need to
-- allow transitioning directly to pending_review (300) with manual override.

INSERT INTO public.state_transitions (from_status, to_status, is_manual, description)
SELECT from_status, to_status, true, description
FROM (VALUES
  -- From enrichment "ready" states
  (210, 300, 'to_summarize → pending_review (manual recovery)'),
  (220, 300, 'to_tag → pending_review (manual recovery)'),
  (230, 300, 'to_thumbnail → pending_review (manual recovery)'),
  (240, 300, 'enriched → pending_review (manual)'),
  -- From enrichment "in-progress" states
  (211, 300, 'summarizing → pending_review (manual recovery)'),
  (221, 300, 'tagging → pending_review (manual recovery)'),
  (231, 300, 'thumbnailing → pending_review (manual recovery)')
) AS t(from_status, to_status, description)
WHERE EXISTS (SELECT 1 FROM public.status_lookup WHERE code = t.from_status)
  AND EXISTS (SELECT 1 FROM public.status_lookup WHERE code = t.to_status)
ON CONFLICT (from_status, to_status, is_manual) DO NOTHING;
