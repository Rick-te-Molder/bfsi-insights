/**
 * Quality Gate Limits - Single Source of Truth
 *
 * Shared constants for both pre-commit checks and nightly reports.
 * Change limits here to affect both systems consistently.
 *
 * References:
 * - Maintainability model (Software Improvement Group)
 * - "Building Maintainable Software" by Joost Visser
 */

// 300/30 size limits per language (source files)
const LANGUAGE_LIMITS = {
  js: { file: 300, unit: 30, unitExcellent: 15 },
  ts: { file: 300, unit: 30, unitExcellent: 15 },
  tsx: { file: 300, unit: 30, unitExcellent: 15 },
  jsx: { file: 300, unit: 30, unitExcellent: 15 },
  astro: { file: 300, unit: 30, unitExcellent: 15 },
  py: { file: 250, unit: 25, unitExcellent: 15 },
  java: { file: 300, unit: 30, unitExcellent: 15 },
  default: { file: 300, unit: 30, unitExcellent: 15 },
};

// Relaxed limits for test files (allow longer test tables/fixtures)
const TEST_LIMITS = {
  js: { file: 500, unit: 50, unitExcellent: 30 },
  ts: { file: 500, unit: 50, unitExcellent: 30 },
  tsx: { file: 500, unit: 50, unitExcellent: 30 },
  jsx: { file: 500, unit: 50, unitExcellent: 30 },
  default: { file: 500, unit: 50, unitExcellent: 30 },
};

// Parameter count thresholds
const PARAM_LIMITS = {
  optimal: 3,
  warn: 5,
  block: 6,
  maxDestructuredKeys: 7,
};

// Allowed file extensions for quality checks
const ALLOWED_EXT = new Set(['.ts', '.js', '.tsx', '.jsx', '.astro']);

// Path prefixes to include in quality checks
const ALLOWED_PREFIXES = [
  'apps/web/',
  'apps/admin/src/',
  'services/agent-api/', // includes src/ and __tests__/
];

module.exports = {
  LANGUAGE_LIMITS,
  TEST_LIMITS,
  PARAM_LIMITS,
  ALLOWED_EXT,
  ALLOWED_PREFIXES,
};
