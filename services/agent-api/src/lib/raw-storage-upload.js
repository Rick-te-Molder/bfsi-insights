/**
 * Raw Storage - Upload and Registry Operations
 * ADR-004: Raw Data Storage Strategy
 */

import { getSupabase } from './supabase.js';

/**
 * Upload raw content to Supabase Storage
 * @param {Buffer} buffer - Content bytes
 * @param {string} hash - SHA-256 hash (64-char hex)
 * @param {string} ext - File extension
 * @param {string} mime - MIME type
 * @returns {Promise<{rawRef: string|null, error: Error|null}>}
 */
export async function uploadToStorage(buffer, hash, ext, mime) {
  const supabase = getSupabase();
  const rawRef = `${hash}.${ext}`;

  const { error } = await supabase.storage.from('kb-raw').upload(rawRef, buffer, {
    contentType: mime,
    upsert: true,
  });

  return error ? { rawRef: null, error } : { rawRef, error: null };
}

/**
 * UPSERT into raw_object table
 * @param {object} params
 * @param {string} params.contentHash - SHA-256 hash
 * @param {string} params.rawRef - Storage key
 * @param {string} params.mimeDetected - Detected MIME type
 * @param {number} params.bytes - File size
 * @param {string} params.rawStoreMode - 'full', 'partial', or 'none'
 * @returns {Promise<{error: Error|null}>}
 */
export async function upsertRawObject({
  contentHash,
  rawRef,
  mimeDetected,
  bytes,
  rawStoreMode = 'full',
}) {
  const supabase = getSupabase();

  const { error } = await supabase.from('raw_object').upsert(
    {
      content_hash: contentHash,
      raw_ref: rawRef,
      mime_detected: mimeDetected,
      bytes,
      raw_store_mode: rawStoreMode,
    },
    { onConflict: 'content_hash', ignoreDuplicates: true },
  );

  return { error };
}
