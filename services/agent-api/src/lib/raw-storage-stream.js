/**
 * Raw Storage - Streaming Hash with Size Limit
 * ADR-004: Raw Data Storage Strategy
 * US-3: Size Limit Handling
 */

import crypto from 'node:crypto';
import { RAW_STORAGE_MAX_BYTES } from './constants.js';

/**
 * Hash a readable stream while tracking size
 * Buffers content up to maxBytes, then continues hashing without buffering
 *
 * @param {ReadableStream} readable - Readable stream to hash
 * @param {number} maxBytes - Maximum bytes to buffer (default: 50 MB)
 * @returns {Promise<{contentHash: string, bytes: number, isOversize: boolean, buffer: Buffer|null}>}
 */
export async function hashStreamWithLimit(readable, maxBytes = RAW_STORAGE_MAX_BYTES) {
  const hash = crypto.createHash('sha256');
  let totalBytes = 0;
  let isOversize = false;
  const chunks = [];

  for await (const chunk of readable) {
    hash.update(chunk);
    totalBytes += chunk.length;

    if (!isOversize && totalBytes <= maxBytes) {
      chunks.push(chunk);
    } else if (!isOversize) {
      isOversize = true;
      console.log(
        `   ⚠️ File exceeds ${maxBytes / 1024 / 1024} MB limit (${totalBytes} bytes so far)`,
      );
    }
  }

  return {
    contentHash: hash.digest('hex'),
    bytes: totalBytes,
    isOversize,
    buffer: isOversize ? null : Buffer.concat(chunks),
  };
}

/** Build HTTP error result */
function buildHttpErrorResult(response) {
  return {
    success: false,
    status: response.status,
    contentType: response.headers.get('content-type'),
    finalUrl: response.url,
    error: `HTTP ${response.status}`,
  };
}

/** Build success result from hash result */
function buildStreamSuccessResult(hashResult, response) {
  return {
    success: true,
    ...hashResult,
    status: response.status,
    contentType: response.headers.get('content-type'),
    finalUrl: response.url,
  };
}

/** Build error result from catch */
function buildStreamErrorResult(error) {
  const message = error.name === 'AbortError' ? 'Request timeout' : error.message;
  return { success: false, status: 0, error: message };
}

/**
 * Fetch URL with streaming hash and size limit
 * @param {string} url - URL to fetch
 * @param {number} maxBytes - Maximum bytes to buffer
 */
export async function fetchWithStreamingHash(url, maxBytes = RAW_STORAGE_MAX_BYTES) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BFSI-Insights/1.0)', Accept: '*/*' },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) return buildHttpErrorResult(response);

    const hashResult = await hashStreamWithLimit(response.body, maxBytes);
    return buildStreamSuccessResult(hashResult, response);
  } catch (error) {
    clearTimeout(timeout);
    return buildStreamErrorResult(error);
  }
}
