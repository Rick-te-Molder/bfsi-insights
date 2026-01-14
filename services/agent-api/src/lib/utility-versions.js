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

/** @type {Record<string, string>} */
export const UTILITY_VERSIONS = {
  'thumbnail-generator': '1.1',
  // Add other utility agents here as needed
  // 'fetcher': '1.0.0',
  // 'extractor': '1.0.0',
};

/**
 * Get current implementation version for a utility agent
 */
/** @param {string} agentName */
export function getUtilityVersion(agentName) {
  return UTILITY_VERSIONS[agentName] || '0.0.0';
}

export async function syncUtilityVersionsToDb() {
  const { getSupabaseAdminClient } = await import('../clients/supabase.js');
  const supabase = getSupabaseAdminClient();
  const rows = Object.entries(UTILITY_VERSIONS).map(([agent_name, version]) => ({
    agent_name,
    version,
  }));
  const { error } = await supabase
    .from('utility_version')
    .upsert(rows, { onConflict: 'agent_name' });
  if (error) {
    console.warn('⚠️ Failed to sync utility versions:', error.message);
  }
}
