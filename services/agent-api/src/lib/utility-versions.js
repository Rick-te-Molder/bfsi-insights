/**
 * Utility Agent Version Registry
 *
 * Tracks implementation versions for utility agents (non-LLM agents).
 * Increment versions when changing implementation logic that should trigger re-processing.
 *
 * Version format: MAJOR.MINOR.PATCH
 * - MAJOR: Breaking changes (e.g., different output format)
 * - MINOR: New features (e.g., multiple thumbnail sizes)
 * - PATCH: Bug fixes, optimizations
 */

export const UTILITY_VERSIONS = {
  'thumbnail-generator': '1.0.0',
  // Add other utility agents here as needed
  // 'fetcher': '1.0.0',
  // 'extractor': '1.0.0',
};

/**
 * Get current implementation version for a utility agent
 */
export function getUtilityVersion(agentName) {
  return UTILITY_VERSIONS[agentName] || '0.0.0';
}
