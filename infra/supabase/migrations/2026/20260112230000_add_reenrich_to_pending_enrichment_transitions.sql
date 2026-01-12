-- Migration: Add state transitions for full re-enrichment
-- Allows review/published items to transition to pending_enrichment (200) for full re-enrichment
-- These are manual transitions only (require _manual_override: true in payload)

-- Add manual transitions from common review/published states to pending_enrichment
-- Only include status codes that exist in status_lookup
INSERT INTO public.state_transitions (from_status, to_status, is_manual, description)
SELECT from_status, 200, true, description
FROM (VALUES
  (300, 'pending_review → pending_enrichment (full re-enrich)'),
  (310, 'in_review → pending_enrichment (full re-enrich)'),
  (320, 'editing → pending_enrichment (full re-enrich)'),
  (400, 'published → pending_enrichment (full re-enrich)'),
  (410, 'updated → pending_enrichment (full re-enrich)')
) AS t(from_status, description)
WHERE EXISTS (SELECT 1 FROM public.status_lookup WHERE code = t.from_status)
ON CONFLICT (from_status, to_status, is_manual) DO NOTHING;
