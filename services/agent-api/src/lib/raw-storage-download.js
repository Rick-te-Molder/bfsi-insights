/**
 * Raw Storage - Download Operations
 * ADR-004: Raw Data Storage Strategy
 * US-4: Enricher Integration — Read from Storage
 */

import { getSupabase } from './supabase.js';
import { fetchRawBytes } from './content-fetcher-http.js';

/**
 * Check if item should use storage
 * @param {object} item - Queue item with raw_ref, storage_deleted_at, raw_store_mode
 * @returns {boolean}
 */
function shouldUseStorage(item) {
  if (!item.raw_ref) return false;
  if (item.storage_deleted_at) return false;
  if (item.raw_store_mode === 'none') return false;
  return true;
}

/**
 * Download raw content from Supabase Storage
 * @param {string} rawRef - Storage key
 * @returns {Promise<{success: boolean, buffer?: Buffer, error?: string}>}
 */
async function downloadFromStorage(rawRef) {
  const supabase = getSupabase();

  try {
    const { data, error } = await supabase.storage.from('kb-raw').download(rawRef);
    if (error) {
      return { success: false, error: error.message };
    }
    const buffer = Buffer.from(await data.arrayBuffer());
    return { success: true, buffer };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Fetch raw content from URL (fallback)
 * @param {string} url - URL to fetch
 * @returns {Promise<{success: boolean, buffer?: Buffer, error?: string}>}
 */
async function fetchFromUrl(url) {
  const result = await fetchRawBytes(url);
  if (!result.success) {
    return { success: false, error: result.error };
  }
  return { success: true, buffer: result.buffer };
}

/**
 * Get raw content for enrichment
 * Tries storage first, falls back to URL fetch
 *
 * @param {object} item - Queue item with url, raw_ref, storage_deleted_at, raw_store_mode
 * @returns {Promise<{source: 'storage'|'url', buffer: Buffer|null, error?: string}>}
 */
export async function getRawContent(item) {
  // Skip storage if not available
  if (!shouldUseStorage(item)) {
    console.log('   📥 Source: url (no raw_ref or deleted)');
    const result = await fetchFromUrl(item.url);
    return { source: 'url', buffer: result.buffer || null, error: result.error };
  }

  // Try storage first
  const storageResult = await downloadFromStorage(item.raw_ref);

  if (storageResult.success) {
    console.log(`   📦 Source: storage (${item.raw_ref})`);
    return { source: 'storage', buffer: storageResult.buffer };
  }

  // Storage failed, fall back to URL
  console.warn(`   ⚠️ storage_miss: ${item.raw_ref} - ${storageResult.error}`);
  console.log('   📥 Source: url (storage fallback)');

  const urlResult = await fetchFromUrl(item.url);
  return { source: 'url', buffer: urlResult.buffer || null, error: urlResult.error };
}

/**
 * Get raw content as text for enrichment
 * Convenience wrapper that converts buffer to string
 *
 * @param {object} item - Queue item
 * @returns {Promise<{source: 'storage'|'url', content: string|null, error?: string}>}
 */
export async function getRawContentAsText(item) {
  const result = await getRawContent(item);

  if (!result.buffer) {
    return { source: result.source, content: null, error: result.error };
  }

  return { source: result.source, content: result.buffer.toString('utf-8') };
}
