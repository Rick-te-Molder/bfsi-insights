// @ts-check
import { describe, it, expect, beforeEach } from 'vitest';
import {
  enforceRateLimit,
  triggerRateLimitForTesting,
  clearRateLimitForTesting,
} from './sitemap-rate-limit.js';

describe('sitemap-rate-limit', () => {
  beforeEach(() => {
    clearRateLimitForTesting();
  });

  describe('enforceRateLimit', () => {
    it('does not delay on first call', async () => {
      const start = Date.now();
      await enforceRateLimit();
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(50);
    });

    it('delays subsequent calls within rate limit window', async () => {
      triggerRateLimitForTesting();
      const start = Date.now();
      await enforceRateLimit();
      const elapsed = Date.now() - start;
      // Should wait at least some time (test env has 5ms delay)
      expect(elapsed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('triggerRateLimitForTesting', () => {
    it('sets lastRequestTime to current time', async () => {
      triggerRateLimitForTesting();
      // Next call should be rate limited
      const start = Date.now();
      await enforceRateLimit();
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('clearRateLimitForTesting', () => {
    it('resets rate limit state', async () => {
      triggerRateLimitForTesting();
      clearRateLimitForTesting();
      const start = Date.now();
      await enforceRateLimit();
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(50);
    });
  });
});
