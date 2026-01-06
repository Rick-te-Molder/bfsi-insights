// @ts-check
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  delay,
  FETCH_HEADERS,
  handleHttpError,
  handleFetchError,
  attemptFetch,
} from './content-fetcher-http.js';

describe('content-fetcher-http', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    globalThis.fetch = vi.fn();
  });

  describe('delay', () => {
    it('resolves after specified time', async () => {
      const start = Date.now();
      await delay(50);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(40);
    });
  });

  describe('FETCH_HEADERS', () => {
    it('has User-Agent header', () => {
      expect(FETCH_HEADERS['User-Agent']).toContain('Mozilla');
    });

    it('has Accept header', () => {
      expect(FETCH_HEADERS['Accept']).toContain('text/html');
    });

    it('has Accept-Language header', () => {
      expect(FETCH_HEADERS['Accept-Language']).toContain('en');
    });
  });

  describe('handleHttpError', () => {
    it('returns permanentFailure for 404', () => {
      const response = { status: 404 };
      const result = handleHttpError(response, 1, 3);
      expect(result.permanentFailure).toBe(true);
      expect(result.status).toBe(404);
    });

    it('returns permanentFailure for 410 Gone', () => {
      const response = { status: 410 };
      const result = handleHttpError(response, 1, 3);
      expect(result.permanentFailure).toBe(true);
    });

    it('returns forbidden for 403', () => {
      const response = { status: 403 };
      const result = handleHttpError(response, 1, 3);
      expect(result.forbidden).toBe(true);
    });

    it('returns retry for 500 when retries remain', () => {
      const response = { status: 500 };
      const result = handleHttpError(response, 1, 3);
      expect(result.retry).toBe(true);
    });

    it('returns shouldThrow for 500 when no retries remain', () => {
      const response = { status: 500 };
      const result = handleHttpError(response, 3, 3);
      expect(result.shouldThrow).toBe(true);
    });

    it('returns shouldThrow for non-retryable status', () => {
      const response = { status: 400 };
      const result = handleHttpError(response, 1, 3);
      expect(result.shouldThrow).toBe(true);
    });
  });

  describe('handleFetchError', () => {
    it('returns retry for timeout when retries remain', () => {
      const error = { name: 'AbortError' };
      const result = handleFetchError(error, 1, 3);
      expect(result.retry).toBe(true);
    });

    it('returns shouldThrow for timeout when no retries remain', () => {
      const error = { name: 'AbortError' };
      const result = handleFetchError(error, 3, 3);
      expect(result.shouldThrow).toBe(true);
      expect(result.message).toBe('Request timeout');
    });

    it('returns retry for network error when retries remain', () => {
      const error = { message: 'Network error' };
      const result = handleFetchError(error, 1, 3);
      expect(result.retry).toBe(true);
    });

    it('returns shouldThrow with error when no retries remain', () => {
      const error = new Error('Network failed');
      const result = handleFetchError(error, 3, 3);
      expect(result.shouldThrow).toBe(true);
      expect(result.error).toBe(error);
    });
  });

  describe('attemptFetch', () => {
    it('returns success with HTML on successful fetch', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<html>content</html>'),
      });

      const result = await attemptFetch('https://example.com', 1, 3);

      expect(result.success).toBe(true);
      expect(result.html).toBe('<html>content</html>');
    });

    it('returns retry for 500 error', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await attemptFetch('https://example.com', 1, 3);

      expect(result.retry).toBe(true);
    });

    it('throws for permanent failure', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await attemptFetch('https://example.com', 1, 3);

      expect(result.permanentFailure).toBe(true);
    });

    it('handles network errors with retry', async () => {
      vi.mocked(globalThis.fetch).mockRejectedValue(new Error('Network error'));

      const result = await attemptFetch('https://example.com', 1, 3);

      expect(result.retry).toBe(true);
    });

    it('throws when all retries exhausted on error', async () => {
      vi.mocked(globalThis.fetch).mockRejectedValue(new Error('Network error'));

      await expect(attemptFetch('https://example.com', 3, 3)).rejects.toThrow('Network error');
    });
  });
});
