/**
 * Pipeline Status Codes
 * See docs/architecture/pipeline-status-codes.md for full documentation
 */

// =============================================================================
// Status Code Constants
// =============================================================================

export const STATUS = {
  // 100s: Discovery
  DISCOVERED: 100,
  TO_FETCH: 110,
  FETCHING: 111,
  FETCHED: 112,
  TO_SCORE: 120,
  SCORING: 121,
  SCORED: 122,

  // 200s: Enrichment
  PENDING_ENRICHMENT: 200,
  TO_SUMMARIZE: 210,
  SUMMARIZING: 211,
  SUMMARIZED: 212,
  TO_TAG: 220,
  TAGGING: 221,
  TAGGED: 222,
  TO_THUMBNAIL: 230,
  THUMBNAILING: 231,
  THUMBNAILED: 232,
  ENRICHED: 240,

  // 300s: Review
  PENDING_REVIEW: 300,
  IN_REVIEW: 310,
  EDITING: 320,
  APPROVED: 330,

  // 400s: Published
  PUBLISHED: 400,
  UPDATED: 410,

  // 500s: Terminal/Error
  FAILED: 500,
  UNREACHABLE: 510,
  DUPLICATE: 520,
  IRRELEVANT: 530,
  REJECTED: 540,
} as const;

export type StatusCode = (typeof STATUS)[keyof typeof STATUS];

// =============================================================================
// Status Names (for display)
// =============================================================================

export const STATUS_NAMES: Record<StatusCode, string> = {
  [STATUS.DISCOVERED]: 'Discovered',
  [STATUS.TO_FETCH]: 'To Fetch',
  [STATUS.FETCHING]: 'Fetching',
  [STATUS.FETCHED]: 'Fetched',
  [STATUS.TO_SCORE]: 'To Score',
  [STATUS.SCORING]: 'Scoring',
  [STATUS.SCORED]: 'Scored',

  [STATUS.PENDING_ENRICHMENT]: 'Pending Enrichment',
  [STATUS.TO_SUMMARIZE]: 'To Summarize',
  [STATUS.SUMMARIZING]: 'Summarizing',
  [STATUS.SUMMARIZED]: 'Summarized',
  [STATUS.TO_TAG]: 'To Tag',
  [STATUS.TAGGING]: 'Tagging',
  [STATUS.TAGGED]: 'Tagged',
  [STATUS.TO_THUMBNAIL]: 'To Thumbnail',
  [STATUS.THUMBNAILING]: 'Thumbnailing',
  [STATUS.THUMBNAILED]: 'Thumbnailed',
  [STATUS.ENRICHED]: 'Enriched',

  [STATUS.PENDING_REVIEW]: 'Pending Review',
  [STATUS.IN_REVIEW]: 'In Review',
  [STATUS.EDITING]: 'Editing',
  [STATUS.APPROVED]: 'Approved',

  [STATUS.PUBLISHED]: 'Published',
  [STATUS.UPDATED]: 'Updated',

  [STATUS.FAILED]: 'Failed',
  [STATUS.UNREACHABLE]: 'Unreachable',
  [STATUS.DUPLICATE]: 'Duplicate',
  [STATUS.IRRELEVANT]: 'Irrelevant',
  [STATUS.REJECTED]: 'Rejected',
};

// =============================================================================
// Status Categories
// =============================================================================

export type StatusCategory = 'discovery' | 'enrichment' | 'review' | 'published' | 'terminal';

export const STATUS_CATEGORY: Record<StatusCode, StatusCategory> = {
  [STATUS.DISCOVERED]: 'discovery',
  [STATUS.TO_FETCH]: 'discovery',
  [STATUS.FETCHING]: 'discovery',
  [STATUS.FETCHED]: 'discovery',
  [STATUS.TO_SCORE]: 'discovery',
  [STATUS.SCORING]: 'discovery',
  [STATUS.SCORED]: 'discovery',

  [STATUS.PENDING_ENRICHMENT]: 'enrichment',
  [STATUS.TO_SUMMARIZE]: 'enrichment',
  [STATUS.SUMMARIZING]: 'enrichment',
  [STATUS.SUMMARIZED]: 'enrichment',
  [STATUS.TO_TAG]: 'enrichment',
  [STATUS.TAGGING]: 'enrichment',
  [STATUS.TAGGED]: 'enrichment',
  [STATUS.TO_THUMBNAIL]: 'enrichment',
  [STATUS.THUMBNAILING]: 'enrichment',
  [STATUS.THUMBNAILED]: 'enrichment',
  [STATUS.ENRICHED]: 'enrichment',

  [STATUS.PENDING_REVIEW]: 'review',
  [STATUS.IN_REVIEW]: 'review',
  [STATUS.EDITING]: 'review',
  [STATUS.APPROVED]: 'review',

  [STATUS.PUBLISHED]: 'published',
  [STATUS.UPDATED]: 'published',

  [STATUS.FAILED]: 'terminal',
  [STATUS.UNREACHABLE]: 'terminal',
  [STATUS.DUPLICATE]: 'terminal',
  [STATUS.IRRELEVANT]: 'terminal',
  [STATUS.REJECTED]: 'terminal',
};

// =============================================================================
// Helper Functions
// =============================================================================

/** Check if status is in discovery phase (100s) */
export const isDiscovery = (code: number): boolean => code >= 100 && code < 200;

/** Check if status is in enrichment phase (200s) */
export const isEnrichment = (code: number): boolean => code >= 200 && code < 300;

/** Check if status is in review phase (300s) */
export const isReview = (code: number): boolean => code >= 300 && code < 400;

/** Check if status is published (400s) */
export const isPublished = (code: number): boolean => code >= 400 && code < 500;

/** Check if status is terminal/error (500s) */
export const isTerminal = (code: number): boolean => code >= 500;

/** Check if status is a "ready" state (ends in 0) */
export const isReady = (code: number): boolean => code % 10 === 0 && code < 500;

/** Check if status is "in progress" (ends in 1) */
export const isInProgress = (code: number): boolean => code % 10 === 1;

/** Check if status is "complete" (ends in 2) */
export const isComplete = (code: number): boolean => code % 10 === 2;

/** Get category for a status code */
export const getCategory = (code: number): StatusCategory => {
  if (code >= 500) return 'terminal';
  if (code >= 400) return 'published';
  if (code >= 300) return 'review';
  if (code >= 200) return 'enrichment';
  return 'discovery';
};

/** Get display name for a status code */
export const getStatusName = (code: number): string => {
  return STATUS_NAMES[code as StatusCode] || `Unknown (${code})`;
};

// =============================================================================
// Legacy Status Mapping (for migration)
// =============================================================================

export const LEGACY_STATUS_MAP: Record<string, StatusCode> = {
  pending: STATUS.PENDING_ENRICHMENT,
  queued: STATUS.PENDING_ENRICHMENT,
  processing: STATUS.SUMMARIZING,
  enriched: STATUS.PENDING_REVIEW,
  approved: STATUS.APPROVED,
  rejected: STATUS.REJECTED,
  failed: STATUS.FAILED,
};

/** Convert legacy text status to new numeric code */
export const fromLegacyStatus = (status: string): StatusCode => {
  return LEGACY_STATUS_MAP[status] || STATUS.PENDING_ENRICHMENT;
};
