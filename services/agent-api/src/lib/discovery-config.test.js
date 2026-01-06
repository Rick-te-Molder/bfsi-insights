// @ts-check
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: vi.fn() })),
}));

import { isPoorTitle, clearDiscoveryConfigCache } from './discovery-config.js';

describe('discovery-config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearDiscoveryConfigCache();
  });

  describe('isPoorTitle', () => {
    it('returns true for null title', () => {
      expect(isPoorTitle(null)).toBe(true);
    });

    it('returns true for undefined title', () => {
      expect(isPoorTitle(undefined)).toBe(true);
    });

    it('returns true for empty string', () => {
      expect(isPoorTitle('')).toBe(true);
    });

    it('returns true for short title (< 10 chars)', () => {
      expect(isPoorTitle('Short')).toBe(true);
    });

    it('returns true for title without spaces', () => {
      expect(isPoorTitle('NoSpacesHere')).toBe(true);
    });

    it('returns true for URL slug patterns like fil123', () => {
      expect(isPoorTitle('fil 123 document')).toBe(true);
    });

    it('returns true for URL slug patterns like nr123', () => {
      expect(isPoorTitle('nr 456 report')).toBe(true);
    });

    it('returns true for URL slug patterns like bulletin123', () => {
      expect(isPoorTitle('bulletin 789 update')).toBe(true);
    });

    it('returns false for good title with spaces', () => {
      expect(isPoorTitle('This is a good title with spaces')).toBe(false);
    });

    it('returns false for proper article title', () => {
      expect(isPoorTitle('How AI is Transforming Banking')).toBe(false);
    });

    it('returns false for longer title with multiple words', () => {
      expect(isPoorTitle('The Future of Financial Services in 2024')).toBe(false);
    });
  });

  describe('clearDiscoveryConfigCache', () => {
    it('clears the cache without error', () => {
      expect(() => clearDiscoveryConfigCache()).not.toThrow();
    });
  });
});
