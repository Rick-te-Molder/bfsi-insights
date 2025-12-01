/**
 * Pure helper functions for the evals framework
 * Extracted for testability (no external dependencies)
 */

/**
 * Compare expected vs actual output
 * @param {any} expected - Expected output
 * @param {any} actual - Actual output
 * @returns {{ match: boolean, score: number }}
 */
export function compareOutputs(expected, actual) {
  if (
    typeof expected === 'object' &&
    expected !== null &&
    typeof actual === 'object' &&
    actual !== null &&
    !Array.isArray(expected) &&
    !Array.isArray(actual)
  ) {
    // Deep comparison for objects (not arrays)
    let matches = 0;
    let total = 0;

    for (const key of Object.keys(expected)) {
      total++;
      if (JSON.stringify(expected[key]) === JSON.stringify(actual[key])) {
        matches++;
      }
    }

    const score = total > 0 ? matches / total : 0;
    return { match: score >= 0.8, score };
  }

  // Simple equality for primitives and arrays
  const match = JSON.stringify(expected) === JSON.stringify(actual);
  return { match, score: match ? 1 : 0 };
}

/**
 * Calculate pass rate from results
 * @param {number} passed - Number of passed tests
 * @param {number} total - Total number of tests
 * @returns {number} Pass rate (0-1)
 */
export function calculatePassRate(passed, total) {
  if (total === 0) return 0;
  return passed / total;
}

/**
 * Determine if score meets threshold
 * @param {number} score - Score (0-1)
 * @param {number} threshold - Threshold (default 0.7)
 * @returns {boolean}
 */
export function meetsThreshold(score, threshold = 0.7) {
  return score >= threshold;
}
