// @ts-check
import { describe, it, expect } from 'vitest';
import { isPdfUrl } from './url-utils.js';

describe('url-utils', () => {
  describe('isPdfUrl', () => {
    it('returns true for URL ending in .pdf', () => {
      expect(isPdfUrl('https://example.com/document.pdf')).toBe(true);
    });

    it('returns true for URL with .PDF extension (case insensitive)', () => {
      expect(isPdfUrl('https://example.com/document.PDF')).toBe(true);
    });

    it('returns true for URL with pdf query parameter', () => {
      expect(isPdfUrl('https://example.com/doc?pdf=1')).toBe(true);
    });

    it('returns true for arXiv PDF URLs', () => {
      expect(isPdfUrl('https://arxiv.org/pdf/2301.12345')).toBe(true);
    });

    it('returns true for arXiv PDF URLs with subdomain', () => {
      expect(isPdfUrl('https://export.arxiv.org/pdf/2301.12345')).toBe(true);
    });

    it('returns false for regular HTML URLs', () => {
      expect(isPdfUrl('https://example.com/article')).toBe(false);
    });

    it('returns false for URLs with pdf in path but not as file', () => {
      expect(isPdfUrl('https://example.com/pdf-articles/document')).toBe(false);
    });

    it('returns false for invalid URLs', () => {
      expect(isPdfUrl('not-a-url')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isPdfUrl('')).toBe(false);
    });

    it('handles URL with fragment', () => {
      expect(isPdfUrl('https://example.com/document.pdf#page=5')).toBe(true);
    });

    it('handles URL with query string after .pdf', () => {
      expect(isPdfUrl('https://example.com/document.pdf?download=true')).toBe(true);
    });
  });
});
