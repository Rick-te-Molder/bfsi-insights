-- ============================================================================
-- Migration: Make regulators and regulations expandable instead of guardrails
-- ============================================================================
-- Regulators and regulations are too numerous worldwide to maintain as 
-- guardrails. Change to expandable so LLM can extract and propose new ones.
-- ============================================================================

UPDATE taxonomy_config
SET behavior_type = 'expandable'
WHERE slug IN ('regulator', 'regulation');
