/**
 * Tests for raw-storage.js
 * US-2: Fetcher Integration — Store Raw Content
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeHash,
  detectExtension,
  detectMime,
  storeRawContent,
  isBlockedByHash,
  isBlockedByUrl,
} from './raw-storage.js';

// Mock supabase
vi.mock('./supabase.js', () => ({
  getSupabase: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
    from: vi.fn(() => ({
      upsert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
        not: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    })),
  })),
}));

describe('computeHash', () => {
  it('should compute SHA-256 hash of buffer', () => {
    const buffer = Buffer.from('hello world');
    const hash = computeHash(buffer);

    expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should produce different hashes for different content', () => {
    const hash1 = computeHash(Buffer.from('content A'));
    const hash2 = computeHash(Buffer.from('content B'));

    expect(hash1).not.toBe(hash2);
  });

  it('should produce same hash for identical content (idempotent)', () => {
    const content = Buffer.from('identical content');
    const hash1 = computeHash(content);
    const hash2 = computeHash(content);

    expect(hash1).toBe(hash2);
  });
});

describe('detectExtension', () => {
  it('should detect PDF from magic bytes', () => {
    const pdfBuffer = Buffer.from('%PDF-1.4 some content');
    expect(detectExtension(pdfBuffer, 'text/plain')).toBe('pdf');
  });

  it('should detect HTML from DOCTYPE', () => {
    const htmlBuffer = Buffer.from('<!DOCTYPE html><html><body>Hello</body></html>');
    expect(detectExtension(htmlBuffer, 'text/plain')).toBe('html');
  });

  it('should detect HTML from html tag', () => {
    const htmlBuffer = Buffer.from('<html><body>Hello</body></html>');
    expect(detectExtension(htmlBuffer, 'text/plain')).toBe('html');
  });

  it('should detect XML from xml declaration', () => {
    const xmlBuffer = Buffer.from('<?xml version="1.0"?><root></root>');
    expect(detectExtension(xmlBuffer, 'text/plain')).toBe('xml');
  });

  it('should detect JSON from opening brace', () => {
    const jsonBuffer = Buffer.from('{"key": "value"}');
    expect(detectExtension(jsonBuffer, 'text/plain')).toBe('json');
  });

  it('should detect JSON from opening bracket', () => {
    const jsonBuffer = Buffer.from('[1, 2, 3]');
    expect(detectExtension(jsonBuffer, 'text/plain')).toBe('json');
  });

  it('should fallback to Content-Type header when magic bytes not recognized', () => {
    const textBuffer = Buffer.from('plain text content');
    expect(detectExtension(textBuffer, 'text/html')).toBe('html');
    expect(detectExtension(textBuffer, 'application/pdf')).toBe('pdf');
    expect(detectExtension(textBuffer, 'application/json')).toBe('json');
    expect(detectExtension(textBuffer, 'text/plain')).toBe('txt');
  });

  it('should handle Content-Type with charset', () => {
    const textBuffer = Buffer.from('plain text content');
    expect(detectExtension(textBuffer, 'text/html; charset=utf-8')).toBe('html');
  });

  it('should return bin for unknown content', () => {
    const binaryBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
    expect(detectExtension(binaryBuffer, 'application/octet-stream')).toBe('bin');
    expect(detectExtension(binaryBuffer, null)).toBe('bin');
  });

  it('should return bin for empty buffer', () => {
    expect(detectExtension(Buffer.from(''), null)).toBe('bin');
    expect(detectExtension(null, null)).toBe('bin');
  });

  it('should prefer byte sniffing over Content-Type (MIME mismatch)', () => {
    // PDF content with wrong Content-Type header
    const pdfBuffer = Buffer.from('%PDF-1.4 some content');
    expect(detectExtension(pdfBuffer, 'text/html')).toBe('pdf');

    // HTML content with wrong Content-Type header
    const htmlBuffer = Buffer.from('<!DOCTYPE html><html></html>');
    expect(detectExtension(htmlBuffer, 'application/pdf')).toBe('html');
  });
});

describe('detectMime', () => {
  it('should return correct MIME for PDF', () => {
    const pdfBuffer = Buffer.from('%PDF-1.4 content');
    expect(detectMime(pdfBuffer, null)).toBe('application/pdf');
  });

  it('should return correct MIME for HTML', () => {
    const htmlBuffer = Buffer.from('<!DOCTYPE html><html></html>');
    expect(detectMime(htmlBuffer, null)).toBe('text/html');
  });

  it('should return correct MIME for JSON', () => {
    const jsonBuffer = Buffer.from('{"key": "value"}');
    expect(detectMime(jsonBuffer, null)).toBe('application/json');
  });

  it('should return octet-stream for unknown content', () => {
    const binaryBuffer = Buffer.from([0x00, 0x01, 0x02]);
    expect(detectMime(binaryBuffer, null)).toBe('application/octet-stream');
  });
});

describe('storeRawContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return error for empty buffer', async () => {
    const result = await storeRawContent(Buffer.from(''), null);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Empty buffer');
    expect(result.rawRef).toBeNull();
  });

  it('should return error for null buffer', async () => {
    const result = await storeRawContent(null, null);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Empty buffer');
  });

  it('should compute hash and detect extension', async () => {
    const buffer = Buffer.from('<!DOCTYPE html><html></html>');
    const result = await storeRawContent(buffer, 'text/html');

    expect(result.contentHash).toHaveLength(64);
    expect(result.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.mime).toBe('text/html');
  });

  it('should generate correct rawRef format', async () => {
    const buffer = Buffer.from('%PDF-1.4 content');
    const result = await storeRawContent(buffer, 'application/pdf');

    // rawRef should be <hash>.<ext>
    expect(result.rawRef).toMatch(/^[0-9a-f]{64}\.pdf$/);
  });
});

describe('isBlockedByHash', () => {
  it('should return blocked: false when hash not in blocklist', async () => {
    const result = await isBlockedByHash('a'.repeat(64));

    expect(result.blocked).toBe(false);
    expect(result.reason).toBeNull();
  });
});

describe('isBlockedByUrl', () => {
  it('should return blocked: false when no patterns match', async () => {
    const result = await isBlockedByUrl('https://example.com/page');

    expect(result.blocked).toBe(false);
    expect(result.reason).toBeNull();
  });
});
