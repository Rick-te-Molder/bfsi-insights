/**
 * Scorer Configuration
 *
 * Constants and configuration for the scorer agent.
 * KB-155: Agentic Discovery System - Phase 1
 */

// Minimum score to queue (below this = auto-skip)
export const MIN_RELEVANCE_SCORE = 4;

// Content age thresholds for soft scoring penalties
// KB-206: Use as soft signal, not hard cutoff (don't reject "Attention is All You Need")
export const AGE_PENALTY_THRESHOLD_YEARS = 2;

// Staleness indicators - content with these terms is likely outdated/invalid
// KB-206: Detect tombstone pages and expired content
export const STALENESS_INDICATORS = [
  'inactive',
  'rescinded',
  'expired',
  'superseded',
  'archived',
  'no longer active',
  'no longer valid',
  'no longer current',
  'this page has been removed',
  'this document has been withdrawn',
  'this content is outdated',
];

// Trusted sources that auto-pass relevance filter (core BFSI institutions)
// Slugs must match kb_source.slug in the database
export const TRUSTED_SOURCES = new Set([
  // Central Banks
  'bis',
  'bis-research',
  'bis-innovation',
  'ecb',
  'fed',
  'boe',
  'dnb',
  // Regulators
  'eba',
  'esma',
  'eiopa',
  'fca',
  'pra',
  'fsb',
  'bcbs',
  'fatf',
  'fdic',
  'occ',
  'sec',
  // International Organizations
  'imf',
  // Premium Consultants
  'mckinsey',
  'bcg',
  'bain',
]);
