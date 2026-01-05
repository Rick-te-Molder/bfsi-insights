import { checkRateLimit } from './semantic-scholar-rate-limit.js';

const BASE_URL = 'https://api.semanticscholar.org/graph/v1';

/** @param {string} endpoint @param {Record<string, any>} params */
function buildUrl(endpoint, params) {
  const url = new URL(`${BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  });
  return url;
}

/** @param {Response} response */
async function parseResponse(response) {
  if (response.ok) return response.json();

  if (response.status === 429) {
    console.warn('   ⚠️ Semantic Scholar rate limited (429)');
    return null;
  }

  throw new Error(`HTTP ${response.status}`);
}

/**
 * Make a request to Semantic Scholar API
 * @param {string} endpoint - API endpoint
 * @param {Object} params - Query parameters
 * @returns {Promise<Object|null>}
 */
export async function apiRequest(endpoint, params = {}) {
  if (!checkRateLimit()) {
    console.warn('   ⚠️ Semantic Scholar rate limit reached, skipping');
    return null;
  }

  const url = buildUrl(endpoint, /** @type {Record<string, any>} */ (params));

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'BFSI-Insights/1.0 (research aggregator)',
      },
    });

    return await parseResponse(response);
  } catch (error) {
    const err = /** @type {any} */ (error);
    console.error(`   ❌ Semantic Scholar API error: ${err?.message}`);
    return null;
  }
}

/** @param {string} title */
function cleanTitleForSearch(title) {
  return title
    .replaceAll(/[^\w\s]/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

/**
 * Search for a paper by title
 * @param {string} title - Paper title
 * @returns {Promise<Object|null>} Paper data or null
 */
export async function searchPaper(title) {
  const cleanTitle = cleanTitleForSearch(title);

  const data = await apiRequest('/paper/search', {
    query: cleanTitle,
    fields: 'paperId,title,year,citationCount,influentialCitationCount,authors',
    limit: 3,
  });

  const typed = /** @type {{ data?: any[] } | null} */ (data);

  if (!typed?.data?.length) {
    return null;
  }

  return typed.data[0];
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
