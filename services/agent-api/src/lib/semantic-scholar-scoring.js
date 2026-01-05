// Threshold-based scoring tables (threshold, score)
/** @type {Array<[number, number]>} */
const CITATION_THRESHOLDS = [
  [500, 4],
  [100, 3],
  [10, 2],
  [1, 1],
];
/** @type {Array<[number, number]>} */
const INFLUENTIAL_THRESHOLDS = [
  [50, 2],
  [10, 1.5],
  [1, 1],
];
/** @type {Array<[number, number]>} */
const HINDEX_THRESHOLDS = [
  [50, 2],
  [20, 1.5],
  [10, 1],
  [5, 0.5],
];
/** @type {Array<[number, number]>} */
const VELOCITY_THRESHOLDS = [
  [50, 2],
  [20, 1.5],
  [5, 1],
  [1, 0.5],
];

/**
 * Get score based on value and thresholds
 * @param {number} value - Value to score
 * @param {Array<[number, number]>} thresholds - [[threshold, score], ...]
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

  const typed = /** @type {any} */ (metrics);
  const citationCount = typed.citationCount ?? 0;
  const influentialCitations = typed.influentialCitations ?? 0;
  const maxAuthorHIndex = typed.maxAuthorHIndex ?? 0;
  const citationsPerYear = typed.citationsPerYear ?? 0;

  const citationScore = getThresholdScore(citationCount, CITATION_THRESHOLDS);
  const influentialScore = getThresholdScore(influentialCitations, INFLUENTIAL_THRESHOLDS);
  const authorScore = getThresholdScore(maxAuthorHIndex, HINDEX_THRESHOLDS);
  const velocityScore = getThresholdScore(citationsPerYear, VELOCITY_THRESHOLDS);

  return Math.min(10, citationScore + influentialScore + authorScore + velocityScore);
}
