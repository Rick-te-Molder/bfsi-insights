-- Migration: Add re-enrichment transitions within enrichment phase
-- KB-XXX: Allow re-enrichment from any enrichment status (2XX) back to pending_enrichment (200)
-- This enables "Re-enrich All Outdated" to work for items already in enrichment phase

-- Add manual transitions from enrichment states to pending_enrichment
INSERT INTO public.state_transitions (from_status, to_status, is_manual, description) VALUES
  -- From to_summarize (210)
  (210, 200, true, 'to_summarize → pending_enrichment (re-enrich)'),
  -- From summarizing (211)
  (211, 200, true, 'summarizing → pending_enrichment (re-enrich)'),
  -- From summarized (212)
  (212, 200, true, 'summarized → pending_enrichment (re-enrich)'),
  -- From to_tag (220)
  (220, 200, true, 'to_tag → pending_enrichment (re-enrich)'),
  -- From tagging (221)
  (221, 200, true, 'tagging → pending_enrichment (re-enrich)'),
  -- From tagged (222)
  (222, 200, true, 'tagged → pending_enrichment (re-enrich)'),
  -- From to_thumbnail (230)
  (230, 200, true, 'to_thumbnail → pending_enrichment (re-enrich)'),
  -- From thumbnailing (231)
  (231, 200, true, 'thumbnailing → pending_enrichment (re-enrich)'),
  -- From thumbnailed (232)
  (232, 200, true, 'thumbnailed → pending_enrichment (re-enrich)'),
  -- From enriched (240)
  (240, 200, true, 'enriched → pending_enrichment (re-enrich)')
ON CONFLICT (from_status, to_status, is_manual) DO NOTHING;

COMMENT ON TABLE public.state_transitions IS 'Valid state transitions for pipeline state machine. Includes manual re-enrich transitions from enrichment phase.';
