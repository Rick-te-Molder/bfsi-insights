/** @param {Array<{hIndex?: number}> | undefined} authors */
function getMaxAuthorHIndex(authors) {
  let maxAuthorHIndex = 0;
  if (!authors?.length) return maxAuthorHIndex;

  for (const author of authors) {
    if (author.hIndex && author.hIndex > maxAuthorHIndex) {
      maxAuthorHIndex = author.hIndex;
    }
  }

  return maxAuthorHIndex;
}

/** @param {number} citationCount @param {number | null | undefined} paperYear */
function computeCitationsPerYear(citationCount, paperYear) {
  const currentYear = new Date().getFullYear();
  const age = paperYear ? Math.max(1, currentYear - paperYear) : 1;
  const citationsPerYear = citationCount / age;
  return Math.round(citationsPerYear * 10) / 10;
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

  const typed = /** @type {any} */ (paper);
  const citationCount = typed.citationCount || 0;
  const influentialCitations = typed.influentialCitationCount || 0;
  const paperYear = typed.year;

  return {
    citationCount,
    influentialCitations,
    maxAuthorHIndex: getMaxAuthorHIndex(typed.authors),
    paperYear,
    citationsPerYear: computeCitationsPerYear(citationCount, paperYear),
  };
}
