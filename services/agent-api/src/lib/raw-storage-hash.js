/**
 * Raw Storage - Hash and Extension Detection
 * ADR-004: Raw Data Storage Strategy
 */

import crypto from 'node:crypto';

/**
 * Compute SHA-256 hash of buffer
 * @param {Buffer} buffer - Content bytes
 * @returns {string} 64-character lowercase hex hash
 */
export function computeHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/** MIME to extension mapping */
const MIME_EXT = {
  'text/html': 'html',
  'application/pdf': 'pdf',
  'application/json': 'json',
  'text/plain': 'txt',
  'text/xml': 'xml',
  'application/xml': 'xml',
  'application/xhtml+xml': 'html',
};

/** Extension to MIME mapping */
const EXT_MIME = {
  pdf: 'application/pdf',
  html: 'text/html',
  xml: 'application/xml',
  json: 'application/json',
  txt: 'text/plain',
  bin: 'application/octet-stream',
};

/** Detect extension from magic bytes */
function detectFromMagicBytes(buffer) {
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString() === '%PDF') {
    return 'pdf';
  }

  const start = buffer.subarray(0, 100).toString().trim().toLowerCase();
  if (start.startsWith('<!doctype html') || start.startsWith('<html')) return 'html';
  if (start.startsWith('<?xml')) return 'xml';
  if (start.startsWith('{') || start.startsWith('[')) return 'json';

  return null;
}

/** Detect extension from Content-Type header */
function detectFromContentType(contentType) {
  const mimeType = contentType?.split(';')[0]?.trim()?.toLowerCase();
  if (mimeType && mimeType in MIME_EXT) {
    return MIME_EXT[mimeType];
  }
  return null;
}

/**
 * Detect file extension from buffer content (byte sniffing)
 * @param {Buffer} buffer - Content bytes
 * @param {string|null} contentType - Content-Type header value
 * @returns {string} File extension without dot
 */
export function detectExtension(buffer, contentType) {
  if (!buffer || buffer.length === 0) return 'bin';
  return detectFromMagicBytes(buffer) || detectFromContentType(contentType) || 'bin';
}

/**
 * Detect MIME type from buffer content
 * @param {Buffer} buffer - Content bytes
 * @param {string|null} contentType - Content-Type header value
 * @returns {string} MIME type
 */
export function detectMime(buffer, contentType) {
  const ext = detectExtension(buffer, contentType);
  return EXT_MIME[ext] || 'application/octet-stream';
}
