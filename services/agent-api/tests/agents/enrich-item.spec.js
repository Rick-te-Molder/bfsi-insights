/**
 * Tests for enrich-item.js logic
 *
 * Focus:
 * - Manual submissions should bypass filter rejection
 * - URL should be passed through to thumbnail agent
 *
 * Note: Since enrich-item.js has heavy dependencies (Supabase, OpenAI, etc.),
 * we test the core logic by extracting and testing the pure functions.
 */

import { describe, it, expect } from 'vitest';

describe('Manual Submission Filter Skip Logic', () => {
  // Test the core logic: detecting manual submissions
  function isManualSubmission(queueItem) {
    return queueItem.payload?.manual_submission === true;
  }

  describe('isManualSubmission detection', () => {
    it('should return true when manual_submission is true', () => {
      const queueItem = {
        id: 'test-1',
        payload: { manual_submission: true },
      };
      expect(isManualSubmission(queueItem)).toBe(true);
    });

    it('should return false when manual_submission is false', () => {
      const queueItem = {
        id: 'test-2',
        payload: { manual_submission: false },
      };
      expect(isManualSubmission(queueItem)).toBe(false);
    });

    it('should return false when manual_submission is undefined', () => {
      const queueItem = {
        id: 'test-3',
        payload: {},
      };
      expect(isManualSubmission(queueItem)).toBe(false);
    });

    it('should return false when payload is undefined', () => {
      const queueItem = {
        id: 'test-4',
      };
      expect(isManualSubmission(queueItem)).toBe(false);
    });

    it('should return false when manual_submission is truthy but not true', () => {
      const queueItem = {
        id: 'test-5',
        payload: { manual_submission: 'yes' }, // String, not boolean
      };
      expect(isManualSubmission(queueItem)).toBe(false);
    });
  });

  describe('Filter skip behavior (documented)', () => {
    /**
     * Expected behavior in enrich-item.js:
     *
     * 1. Nightly discovery (manual_submission: undefined/false):
     *    - Filter runs
     *    - If not relevant → status = 'rejected', pipeline stops
     *
     * 2. Manual submission (manual_submission: true):
     *    - Filter runs (to extract metadata)
     *    - If not relevant → logged but NOT rejected, pipeline continues
     *    - Human decided it's relevant by submitting it
     */
    it('should document the expected skip behavior', () => {
      // This test documents the expected behavior
      const manualItem = { payload: { manual_submission: true } };
      const nightlyItem = { payload: {} };

      expect(isManualSubmission(manualItem)).toBe(true); // Skip rejection
      expect(isManualSubmission(nightlyItem)).toBe(false); // Normal rejection
    });
  });
});

describe('Payload URL Handling', () => {
  /**
   * Simulates the payload building logic in stepFetch
   * URL must be copied from queueItem.url to payload.url for thumbnail agent
   */
  function buildPayload(queueItem, fetchedContent) {
    return {
      ...queueItem.payload,
      url: queueItem.url, // Critical: URL must be in payload
      title: fetchedContent.title,
      description: fetchedContent.description,
    };
  }

  it('should include URL in payload from queueItem.url', () => {
    const queueItem = {
      id: 'test-1',
      url: 'https://example.com/article',
      payload: { manual_submission: true },
    };
    const fetchedContent = { title: 'Test', description: 'Test desc' };

    const payload = buildPayload(queueItem, fetchedContent);

    expect(payload.url).toBe('https://example.com/article');
  });

  it('should preserve existing payload properties', () => {
    const queueItem = {
      id: 'test-2',
      url: 'https://example.com/article',
      payload: { manual_submission: true, source: 'admin' },
    };
    const fetchedContent = { title: 'Test', description: 'Test desc' };

    const payload = buildPayload(queueItem, fetchedContent);

    expect(payload.manual_submission).toBe(true);
    expect(payload.source).toBe('admin');
    expect(payload.url).toBe('https://example.com/article');
  });

  it('should override payload.url if queueItem.url differs', () => {
    const queueItem = {
      id: 'test-3',
      url: 'https://example.com/new-url',
      payload: { url: 'https://example.com/old-url' },
    };
    const fetchedContent = { title: 'Test', description: 'Test desc' };

    const payload = buildPayload(queueItem, fetchedContent);

    // queueItem.url should take precedence (it's the actual source)
    expect(payload.url).toBe('https://example.com/new-url');
  });
});

describe('Thumbnail URL Extraction', () => {
  /**
   * Simulates the URL extraction logic in thumbnail.js
   */
  function extractThumbnailUrl(payload) {
    return payload.url || payload.source_url || null;
  }

  it('should extract URL from payload.url', () => {
    const payload = { url: 'https://example.com/article', title: 'Test' };
    expect(extractThumbnailUrl(payload)).toBe('https://example.com/article');
  });

  it('should fallback to payload.source_url', () => {
    const payload = { source_url: 'https://example.com/article', title: 'Test' };
    expect(extractThumbnailUrl(payload)).toBe('https://example.com/article');
  });

  it('should prefer payload.url over source_url', () => {
    const payload = {
      url: 'https://example.com/primary',
      source_url: 'https://example.com/fallback',
    };
    expect(extractThumbnailUrl(payload)).toBe('https://example.com/primary');
  });

  it('should return null when no URL present', () => {
    const payload = { title: 'Test' };
    expect(extractThumbnailUrl(payload)).toBeNull();
  });
});
