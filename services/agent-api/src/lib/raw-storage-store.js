/**
 * Raw Storage - Store and Fetch Operations
 * ADR-004: Raw Data Storage Strategy
 */

import { fetchRawBytes } from './content-fetcher-http.js';
import { computeHash, detectExtension, detectMime } from './raw-storage-hash.js';
import { uploadToStorage, upsertRawObject } from './raw-storage-upload.js';
import { isBlockedByHash, isBlockedByUrl } from './raw-storage-blocklist.js';

/** Build empty buffer error result */
function emptyBufferResult() {
  return {
    success: false,
    rawRef: null,
    contentHash: null,
    mime: null,
    error: 'Empty buffer',
  };
}

/** Build upload error result */
function uploadErrorResult(hash, mime, error) {
  return {
    success: false,
    rawRef: null,
    contentHash: hash,
    mime,
    error: `Storage upload failed: ${error.message}`,
  };
}

/** Build upsert error result */
function upsertErrorResult(rawRef, hash, mime, error) {
  return {
    success: false,
    rawRef,
    contentHash: hash,
    mime,
    error: `raw_object upsert failed: ${error.message}`,
  };
}

/**
 * Store raw content after successful fetch
 * @param {Buffer} buffer - Content bytes
 * @param {string|null} contentType - Content-Type header value
 */
export async function storeRawContent(buffer, contentType) {
  if (!buffer || buffer.length === 0) return emptyBufferResult();

  const hash = computeHash(buffer);
  const ext = detectExtension(buffer, contentType);
  const mime = detectMime(buffer, contentType);

  const { rawRef, error: uploadError } = await uploadToStorage(buffer, hash, ext, mime);
  if (uploadError) return uploadErrorResult(hash, mime, uploadError);

  const { error: upsertError } = await upsertRawObject({
    contentHash: hash,
    rawRef,
    mimeDetected: mime,
    bytes: buffer.length,
    rawStoreMode: 'full',
  });
  if (upsertError) return upsertErrorResult(rawRef, hash, mime, upsertError);

  return { success: true, rawRef, contentHash: hash, mime, error: null };
}

/** Build blocked result */
function blockedResult(url, reason) {
  return {
    success: false,
    rawRef: null,
    contentHash: null,
    mime: null,
    finalUrl: null,
    originalUrl: url,
    fetchStatus: 0,
    fetchError: `Blocked by takedown: ${reason}`,
    buffer: null,
  };
}

/** Build fetch failure result */
function fetchFailureResult(url, fetchResult) {
  return {
    success: false,
    rawRef: null,
    contentHash: null,
    mime: null,
    finalUrl: fetchResult.finalUrl || null,
    originalUrl: url,
    fetchStatus: fetchResult.status || 0,
    fetchError: fetchResult.error || 'Unknown fetch error',
    buffer: null,
  };
}

/** Build hash blocked result */
function hashBlockedResult(url, hash, finalUrl, status, reason) {
  return {
    success: false,
    rawRef: null,
    contentHash: hash,
    mime: null,
    finalUrl,
    originalUrl: url,
    fetchStatus: status,
    fetchError: `Blocked by takedown: ${reason}`,
    buffer: null,
  };
}

/**
 * Fetch content from URL and store raw bytes
 * @param {string} url - URL to fetch
 */
export async function fetchAndStoreRaw(url) {
  const urlBlock = await isBlockedByUrl(url);
  if (urlBlock.blocked) return blockedResult(url, urlBlock.reason);

  const fetchResult = await fetchRawBytes(url);
  if (!fetchResult.success) return fetchFailureResult(url, fetchResult);

  const { buffer, contentType, finalUrl, status } = fetchResult;
  const hash = computeHash(buffer);

  const hashBlock = await isBlockedByHash(hash);
  if (hashBlock.blocked) return hashBlockedResult(url, hash, finalUrl, status, hashBlock.reason);

  const storeResult = await storeRawContent(buffer, contentType);

  return {
    success: storeResult.success,
    rawRef: storeResult.rawRef,
    contentHash: storeResult.contentHash,
    mime: storeResult.mime,
    finalUrl,
    originalUrl: url,
    fetchStatus: status,
    fetchError: storeResult.error,
    buffer: storeResult.success ? buffer : null,
  };
}
