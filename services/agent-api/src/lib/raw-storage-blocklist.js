/**
 * Raw Storage - Blocklist Operations
 * ADR-004: Raw Data Storage Strategy
 */

import { getSupabase } from './supabase.js';

/**
 * Check if content hash is in the takedown blocklist
 * @param {string} contentHash - SHA-256 hash to check
 * @returns {Promise<{blocked: boolean, reason: string|null}>}
 */
export async function isBlockedByHash(contentHash) {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('takedown_blocklist')
    .select('reason')
    .eq('content_hash', contentHash)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error checking blocklist:', error.message);
    return { blocked: false, reason: null };
  }

  return data ? { blocked: true, reason: data.reason } : { blocked: false, reason: null };
}

/**
 * Check if URL matches any pattern in the takedown blocklist
 * @param {string} url - URL to check
 * @returns {Promise<{blocked: boolean, reason: string|null}>}
 */
export async function isBlockedByUrl(url) {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('takedown_blocklist')
    .select('url_pattern, reason')
    .not('url_pattern', 'is', null);

  if (error) {
    console.error('Error checking URL blocklist:', error.message);
    return { blocked: false, reason: null };
  }

  if (!data || data.length === 0) {
    return { blocked: false, reason: null };
  }

  return matchUrlPattern(url, data);
}

/** Match URL against blocklist patterns */
function matchUrlPattern(url, patterns) {
  for (const { url_pattern, reason } of patterns) {
    try {
      if (new RegExp(url_pattern).test(url)) {
        return { blocked: true, reason };
      }
    } catch {
      if (url.includes(url_pattern)) {
        return { blocked: true, reason };
      }
    }
  }
  return { blocked: false, reason: null };
}
