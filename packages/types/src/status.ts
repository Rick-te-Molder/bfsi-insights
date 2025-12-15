/**
 * Status types
 * Represents pipeline status codes from status_lookup table
 */

export interface StatusLookup {
  code: number;
  name: string;
  description?: string;
  phase: StatusPhase;
  is_terminal: boolean;
  sort_order: number;
}

export type StatusPhase = 'discovery' | 'enrichment' | 'review' | 'terminal';

/**
 * Well-known status codes
 * These should match the values in status_lookup table
 */
export const STATUS_CODES = {
  // Discovery phase (100-199)
  DISCOVERED: 100,
  FETCHED: 110,

  // Enrichment phase (200-299)
  TO_SCORE: 200,
  SCORED: 210,
  TO_SCREEN: 215,
  SCREENED: 220,
  TO_SUMMARIZE: 225,
  SUMMARIZED: 230,
  TO_TAG: 235,
  TAGGED: 238,
  TO_THUMBNAIL: 239,
  ENRICHED: 240,

  // Review phase (300-399)
  READY_FOR_REVIEW: 300,
  IN_REVIEW: 310,
  APPROVED: 330,

  // Terminal states (400+)
  PUBLISHED: 400,
  REJECTED: 540,
  FAILED: 599,
} as const;

export type StatusCode = (typeof STATUS_CODES)[keyof typeof STATUS_CODES];
