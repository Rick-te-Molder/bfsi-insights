import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkRateLimit,
  resetRateLimit,
  RATE_LIMIT,
  RATE_WINDOW_MS,
} from '../../src/lib/semantic-scholar-rate-limit.js';

describe('lib/semantic-scholar-rate-limit', () => {
  beforeEach(() => {
    resetRateLimit();
  });

  describe('constants', () => {
    it('has rate limit of 100', () => {
      expect(RATE_LIMIT).toBe(100);
    });

    it('has rate window of 5 minutes', () => {
      expect(RATE_WINDOW_MS).toBe(5 * 60 * 1000);
    });
  });

  describe('checkRateLimit', () => {
    it('allows requests under the limit', () => {
      for (let i = 0; i < 10; i++) {
        expect(checkRateLimit()).toBe(true);
      }
    });

    it('blocks requests at the limit', () => {
      for (let i = 0; i < RATE_LIMIT; i++) {
        checkRateLimit();
      }
      expect(checkRateLimit()).toBe(false);
    });

    it('increments request count', () => {
      expect(checkRateLimit()).toBe(true);
      expect(checkRateLimit()).toBe(true);
      expect(checkRateLimit()).toBe(true);
    });
  });

  describe('resetRateLimit', () => {
    it('resets the counter allowing new requests', () => {
      for (let i = 0; i < RATE_LIMIT; i++) {
        checkRateLimit();
      }
      expect(checkRateLimit()).toBe(false);

      resetRateLimit();

      expect(checkRateLimit()).toBe(true);
    });
  });
});
