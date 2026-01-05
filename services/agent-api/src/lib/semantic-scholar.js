/**
 * Semantic Scholar API Client
 *
 * Free academic paper metadata API for citation counts and author metrics.
 * Rate limit: 100 requests per 5 minutes (no auth required)
 *
 * Docs: https://api.semanticscholar.org/api-docs/
 *
 * KB-155: Agentic Discovery System - Phase 3
 */

export {
  apiRequest,
  searchPaper,
  getPaper,
  getPaperByDoi,
  getPaperByArxiv,
  getAuthor,
} from './semantic-scholar-api.js';

export { extractCitationMetrics } from './semantic-scholar-metrics.js';
export { calculateImpactScore } from './semantic-scholar-scoring.js';
export { getCitationData } from './semantic-scholar-citation-data.js';
export { resetRateLimit, RATE_LIMIT, RATE_WINDOW_MS } from './semantic-scholar-rate-limit.js';
