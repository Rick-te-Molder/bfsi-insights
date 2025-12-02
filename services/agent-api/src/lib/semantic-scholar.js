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

const BASE_URL = 'https://api.semanticscholar.org/graph/v1';

// Rate limiting: track requests to stay under 100/5min
let requestCount = 0;
let windowStart = Date.now();
const RATE_LIMIT = 100;
const RATE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Check and update rate limit
 * @returns {boolean} true if request is allowed
 */
function checkRateLimit() {
  const now = Date.now();

  // Reset window if expired
  if (now - windowStart > RATE_WINDOW_MS) {
    requestCount = 0;
    windowStart = now;
  }

  if (requestCount >= RATE_LIMIT) {
    return false;
  }

  requestCount++;
  return true;
}

/**
 * Make a request to Semantic Scholar API
 * @param {string} endpoint - API endpoint
 * @param {Object} params - Query parameters
 * @returns {Promise<Object|null>}
 */
async function apiRequest(endpoint, params = {}) {
  if (!checkRateLimit()) {
    console.warn('   ⚠️ Semantic Scholar rate limit reached, skipping');
    return null;
  }

  const url = new URL(`${BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  });

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'BFSI-Insights/1.0 (research aggregator)',
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.warn('   ⚠️ Semantic Scholar rate limited (429)');
        return null;
      }
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`   ❌ Semantic Scholar API error: ${error.message}`);
    return null;
  }
}

/**
 * Search for a paper by title
 * @param {string} title - Paper title
 * @returns {Promise<Object|null>} Paper data or null
 */
export async function searchPaper(title) {
  // Clean title for search
  const cleanTitle = title
    .replaceAll(/[^\w\s]/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim()
    .slice(0, 200);

  const data = await apiRequest('/paper/search', {
    query: cleanTitle,
    fields: 'paperId,title,year,citationCount,influentialCitationCount,authors',
    limit: 3,
  });

  if (!data?.data?.length) {
    return null;
  }

  // Find best match (first result is usually best for exact title search)
  return data.data[0];
}

/**
 * Get paper details by Semantic Scholar paper ID
 * @param {string} paperId - Semantic Scholar paper ID
 * @returns {Promise<Object|null>}
 */
export async function getPaper(paperId) {
  return apiRequest(`/paper/${paperId}`, {
    fields:
      'paperId,title,year,citationCount,influentialCitationCount,authors,authors.authorId,authors.name,authors.hIndex',
  });
}

/**
 * Get paper by DOI
 * @param {string} doi - DOI identifier
 * @returns {Promise<Object|null>}
 */
export async function getPaperByDoi(doi) {
  return apiRequest(`/paper/DOI:${encodeURIComponent(doi)}`, {
    fields:
      'paperId,title,year,citationCount,influentialCitationCount,authors,authors.authorId,authors.name,authors.hIndex',
  });
}

/**
 * Get paper by arXiv ID
 * @param {string} arxivId - arXiv ID (e.g., "2301.07041")
 * @returns {Promise<Object|null>}
 */
export async function getPaperByArxiv(arxivId) {
  // Extract just the ID part if full URL given
  const match = /(\d{4}\.\d{4,5})/.exec(arxivId);
  const id = match ? match[1] : arxivId;

  return apiRequest(`/paper/ARXIV:${id}`, {
    fields:
      'paperId,title,year,citationCount,influentialCitationCount,authors,authors.authorId,authors.name,authors.hIndex',
  });
}

/**
 * Get author details including h-index
 * @param {string} authorId - Semantic Scholar author ID
 * @returns {Promise<Object|null>}
 */
export async function getAuthor(authorId) {
  return apiRequest(`/author/${authorId}`, {
    fields: 'authorId,name,hIndex,citationCount,paperCount',
  });
}

/**
 * Extract citation metrics from paper data
 * @param {Object} paper - Paper data from API
 * @returns {Object} Normalized citation metrics
 */
export function extractCitationMetrics(paper) {
  if (!paper) {
    return {
      citationCount: 0,
      influentialCitations: 0,
      maxAuthorHIndex: 0,
      paperYear: null,
      citationsPerYear: 0,
    };
  }

  const citationCount = paper.citationCount || 0;
  const influentialCitations = paper.influentialCitationCount || 0;
  const paperYear = paper.year;

  // Calculate citations per year (normalized for age)
  const currentYear = new Date().getFullYear();
  const age = paperYear ? Math.max(1, currentYear - paperYear) : 1;
  const citationsPerYear = citationCount / age;

  // Get max h-index from authors
  let maxAuthorHIndex = 0;
  if (paper.authors?.length) {
    for (const author of paper.authors) {
      if (author.hIndex && author.hIndex > maxAuthorHIndex) {
        maxAuthorHIndex = author.hIndex;
      }
    }
  }

  return {
    citationCount,
    influentialCitations,
    maxAuthorHIndex,
    paperYear,
    citationsPerYear: Math.round(citationsPerYear * 10) / 10,
  };
}

// Threshold-based scoring tables (threshold, score)
const CITATION_THRESHOLDS = [
  [500, 4],
  [100, 3],
  [10, 2],
  [1, 1],
];
const INFLUENTIAL_THRESHOLDS = [
  [50, 2],
  [10, 1.5],
  [1, 1],
];
const HINDEX_THRESHOLDS = [
  [50, 2],
  [20, 1.5],
  [10, 1],
  [5, 0.5],
];
const VELOCITY_THRESHOLDS = [
  [50, 2],
  [20, 1.5],
  [5, 1],
  [1, 0.5],
];

/**
 * Get score based on value and thresholds
 * @param {number} value - Value to score
 * @param {Array} thresholds - [[threshold, score], ...]
 * @returns {number} Score
 */
function getThresholdScore(value, thresholds) {
  for (const [threshold, score] of thresholds) {
    if (value >= threshold) return score;
  }
  return 0;
}

/**
 * Calculate impact score from citation metrics (0-10 scale)
 * @param {Object} metrics - Citation metrics
 * @returns {number} Impact score 0-10
 */
export function calculateImpactScore(metrics) {
  if (!metrics) return 0;

  const {
    citationCount = 0,
    influentialCitations = 0,
    maxAuthorHIndex = 0,
    citationsPerYear = 0,
  } = metrics;

  const citationScore = getThresholdScore(citationCount, CITATION_THRESHOLDS);
  const influentialScore = getThresholdScore(influentialCitations, INFLUENTIAL_THRESHOLDS);
  const authorScore = getThresholdScore(maxAuthorHIndex, HINDEX_THRESHOLDS);
  const velocityScore = getThresholdScore(citationsPerYear, VELOCITY_THRESHOLDS);

  return Math.min(10, citationScore + influentialScore + authorScore + velocityScore);
}

/**
 * Get citation data for a paper by title or identifier
 * @param {Object} options - { title, doi, arxivId, url }
 * @returns {Promise<{metrics: Object, impactScore: number}|null>}
 */
export async function getCitationData({ title, doi, arxivId, url }) {
  let paper = null;

  // Try arXiv ID first (most reliable for preprints)
  if (arxivId || url?.includes('arxiv.org')) {
    const id = arxivId || /(\d{4}\.\d{4,5})/.exec(url)?.[1];
    if (id) {
      paper = await getPaperByArxiv(id);
    }
  }

  // Try DOI
  if (!paper && doi) {
    paper = await getPaperByDoi(doi);
  }

  // Fall back to title search
  if (!paper && title) {
    paper = await searchPaper(title);
  }

  if (!paper) {
    return null;
  }

  const metrics = extractCitationMetrics(paper);
  const impactScore = calculateImpactScore(metrics);

  return {
    paperId: paper.paperId,
    title: paper.title,
    metrics,
    impactScore,
  };
}

/**
 * Reset rate limit counter (for testing)
 */
export function resetRateLimit() {
  requestCount = 0;
  windowStart = Date.now();
}

export { RATE_LIMIT, RATE_WINDOW_MS };
