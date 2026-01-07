/**
 * Quality Gate Utilities
 *
 * Shared utility functions for both pre-commit checks and nightly reports.
 */
const path = require('node:path');
const {
  LANGUAGE_LIMITS,
  TEST_LIMITS,
  ALLOWED_EXT,
  ALLOWED_PREFIXES,
} = require('./quality-limits.cjs');

/**
 * Normalize path for cross-platform compatibility
 * @param {string} p - Path to normalize
 * @returns {string} Normalized path with forward slashes
 */
function normalizePath(p) {
  return p.replaceAll('\\', '/');
}

/**
 * Check if file is a test file
 * @param {string} filePath - Path to check
 * @returns {boolean} True if file is a test file
 */
function isTestFile(filePath) {
  const f = normalizePath(filePath);
  return (
    f.includes('__tests__/') || f.includes('.test.') || f.includes('.spec.') || /\/tests?\//.test(f)
  );
}

/**
 * Get language-specific limits for a file
 * @param {string} filePath - Path to get limits for
 * @returns {object} Limits object with file, unit, unitExcellent properties
 */
function getLimits(filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const limits = isTestFile(filePath) ? TEST_LIMITS : LANGUAGE_LIMITS;
  return limits[ext] || limits.default;
}

/**
 * Check if file matches quality check criteria (extension + path prefix)
 * @param {string} file - File path to check
 * @returns {boolean} True if file should be checked
 */
function matchesPattern(file) {
  const f = normalizePath(file);
  const ext = path.extname(f).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) return false;
  // Exclude generated/build folders
  if (
    f.includes('dist/') ||
    f.includes('build/') ||
    f.includes('.astro/') ||
    f.includes('node_modules/')
  ) {
    return false;
  }
  return ALLOWED_PREFIXES.some((prefix) => f.startsWith(prefix));
}

// Formatting helpers for report generation
/**
 * Pad string to the right
 * @param {string|number} s - Value to pad
 * @param {number} w - Target width
 * @returns {string} Padded string
 */
function padRight(s, w) {
  return String(s).padEnd(w, ' ');
}

/**
 * Pad string to the left
 * @param {string|number} s - Value to pad
 * @param {number} w - Target width
 * @returns {string} Padded string
 */
function padLeft(s, w) {
  return String(s).padStart(w, ' ');
}

/**
 * Clamp string to max width, adding ellipsis at start if truncated
 * @param {string|number} s - Value to clamp
 * @param {number} w - Max width
 * @returns {string} Clamped string
 */
function clamp(s, w) {
  const text = String(s);
  if (text.length <= w) return text;
  return `…${text.slice(text.length - (w - 1))}`;
}

module.exports = {
  normalizePath,
  isTestFile,
  getLimits,
  matchesPattern,
  padRight,
  padLeft,
  clamp,
};
