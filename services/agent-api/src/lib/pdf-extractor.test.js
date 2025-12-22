/**
 * Tests for PDF extraction and storage utilities
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isPdfUrl, fetchPdfContent } from './pdf-extractor.js';

// Mock global fetch for tests
const mockFetch = vi.fn();

describe('pdf-extractor', () => {
  describe('isPdfUrl', () => {
    it('should detect URLs ending with .pdf', () => {
      expect(isPdfUrl('https://example.com/document.pdf')).toBe(true);
      expect(isPdfUrl('https://arxiv.org/pdf/2411.14251.pdf')).toBe(true);
    });

    it('should detect URLs with pdf query parameter', () => {
      expect(isPdfUrl('https://example.com/document?pdf=true')).toBe(true);
      expect(isPdfUrl('https://example.com/view?pdf')).toBe(true);
    });

    it('should return false for non-PDF URLs', () => {
      expect(isPdfUrl('https://example.com/document.html')).toBe(false);
      expect(isPdfUrl('https://example.com/page')).toBe(false);
    });

    it('should handle invalid URLs gracefully', () => {
      expect(isPdfUrl('not-a-url')).toBe(false);
      expect(isPdfUrl('')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(isPdfUrl('https://example.com/document.PDF')).toBe(true);
      expect(isPdfUrl('https://example.com/document.Pdf')).toBe(true);
    });
  });

  describe('fetchPdfContent', () => {
    beforeEach(() => {
      // Reset all mocks before each test
      vi.clearAllMocks();
      mockFetch.mockReset();
    });

    it('should handle PDF extraction errors gracefully', async () => {
      // Mock fetch to fail
      vi.stubGlobal('fetch', mockFetch.mockRejectedValue(new Error('Network error')));

      await expect(fetchPdfContent('https://example.com/test.pdf')).rejects.toThrow(
        'Failed to extract PDF content',
      );
    });

    it('should handle timeout errors', async () => {
      // Mock fetch to timeout
      vi.stubGlobal(
        'fetch',
        mockFetch.mockImplementation(
          () =>
            new Promise((_, reject) => {
              setTimeout(() => reject(new Error('timeout')), 100);
            }),
        ),
      );

      await expect(fetchPdfContent('https://example.com/test.pdf')).rejects.toThrow();
    });
  });
});
