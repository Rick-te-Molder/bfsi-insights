/**
 * Tests for raw-storage-download.js
 * US-4: Enricher Integration — Read from Storage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getRawContent, getRawContentAsText } from './raw-storage-download.js';

// Mock supabase
vi.mock('./supabase.js', () => ({
  getSupabase: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        download: vi.fn().mockResolvedValue({
          data: new Blob([Buffer.from('stored content')]),
          error: null,
        }),
      })),
    },
  })),
}));

// Mock content-fetcher-http
vi.mock('./content-fetcher-http.js', () => ({
  fetchRawBytes: vi.fn().mockResolvedValue({
    success: true,
    buffer: Buffer.from('fetched content'),
    status: 200,
    contentType: 'text/html',
    finalUrl: 'https://example.com',
  }),
}));

describe('getRawContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should read from storage when raw_ref is present', async () => {
    const item = {
      url: 'https://example.com',
      raw_ref: 'abc123.html',
      storage_deleted_at: null,
      raw_store_mode: 'full',
    };

    const result = await getRawContent(item);

    expect(result.source).toBe('storage');
    expect(result.buffer).not.toBeNull();
  });

  it('should fallback to URL when raw_ref is null', async () => {
    const item = {
      url: 'https://example.com',
      raw_ref: null,
      storage_deleted_at: null,
      raw_store_mode: null,
    };

    const result = await getRawContent(item);

    expect(result.source).toBe('url');
    expect(result.buffer).not.toBeNull();
  });

  it('should fallback to URL when storage_deleted_at is set', async () => {
    const item = {
      url: 'https://example.com',
      raw_ref: 'abc123.html',
      storage_deleted_at: '2024-01-01T00:00:00Z',
      raw_store_mode: 'full',
    };

    const result = await getRawContent(item);

    expect(result.source).toBe('url');
  });

  it('should skip storage for raw_store_mode = none', async () => {
    const item = {
      url: 'https://example.com',
      raw_ref: 'abc123.html',
      storage_deleted_at: null,
      raw_store_mode: 'none',
    };

    const result = await getRawContent(item);

    expect(result.source).toBe('url');
  });
});

describe('getRawContentAsText', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return content as string', async () => {
    const item = {
      url: 'https://example.com',
      raw_ref: 'abc123.html',
      storage_deleted_at: null,
      raw_store_mode: 'full',
    };

    const result = await getRawContentAsText(item);

    expect(result.source).toBe('storage');
    expect(typeof result.content).toBe('string');
  });

  it('should return null content when buffer is null', async () => {
    const item = {
      url: 'https://example.com',
      raw_ref: null,
      storage_deleted_at: null,
      raw_store_mode: null,
    };

    // Mock fetchRawBytes to return failure
    const { fetchRawBytes } = await import('./content-fetcher-http.js');
    fetchRawBytes.mockResolvedValueOnce({
      success: false,
      error: 'Network error',
    });

    const result = await getRawContentAsText(item);

    expect(result.source).toBe('url');
    expect(result.content).toBeNull();
  });
});
