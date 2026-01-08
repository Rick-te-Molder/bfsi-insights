// @ts-check
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  apiRequest,
  searchPaper,
  getPaper,
  getPaperByDoi,
  getPaperByArxiv,
  getAuthor,
} from './semantic-scholar-api.js';

// Mock dependencies
vi.mock('./semantic-scholar-rate-limit.js', () => ({
  checkRateLimit: vi.fn(),
}));

import { checkRateLimit } from './semantic-scholar-rate-limit.js';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('semantic-scholar-api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkRateLimit.mockReturnValue(true);
  });

  describe('apiRequest', () => {
    it('returns null when rate limit is reached', async () => {
      checkRateLimit.mockReturnValue(false);

      const result = await apiRequest('/paper/test');

      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('makes request with correct headers', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ paperId: '123' }),
      });

      await apiRequest('/paper/test', { fields: 'title' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('api.semanticscholar.org'),
        expect.objectContaining({
          headers: { 'User-Agent': 'BFSI-Insights/1.0 (research aggregator)' },
        }),
      );
    });

    it('builds URL with query parameters', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await apiRequest('/paper/search', { query: 'test', limit: 5 });

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('query=test');
      expect(calledUrl).toContain('limit=5');
    });

    it('returns parsed JSON on success', async () => {
      const mockData = { paperId: '123', title: 'Test Paper' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const result = await apiRequest('/paper/123');

      expect(result).toEqual(mockData);
    });

    it('returns null on 429 rate limit response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
      });

      const result = await apiRequest('/paper/123');

      expect(result).toBeNull();
    });

    it('returns null on fetch error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await apiRequest('/paper/123');

      expect(result).toBeNull();
    });

    it('skips undefined/null params', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await apiRequest('/paper/search', { query: 'test', limit: undefined, offset: null });

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('query=test');
      expect(calledUrl).not.toContain('limit');
      expect(calledUrl).not.toContain('offset');
    });
  });

  describe('searchPaper', () => {
    it('returns first result when papers found', async () => {
      const mockPaper = { paperId: '123', title: 'Found Paper' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [mockPaper, { paperId: '456' }] }),
      });

      const result = await searchPaper('Test Query');

      expect(result).toEqual(mockPaper);
    });

    it('returns null when no papers found', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      const result = await searchPaper('Nonexistent Paper');

      expect(result).toBeNull();
    });

    it('cleans title for search query', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      await searchPaper('Test: Paper! (With @Special# Chars)');

      const calledUrl = mockFetch.mock.calls[0][0];
      // Check the query parameter is cleaned (special chars removed)
      const url = new URL(calledUrl);
      const query = url.searchParams.get('query');
      expect(query).toContain('Test');
      expect(query).not.toContain(':');
      expect(query).not.toContain('!');
      expect(query).not.toContain('@');
    });
  });

  describe('getPaper', () => {
    it('requests paper by ID', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ paperId: 'abc123' }),
      });

      await getPaper('abc123');

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('/paper/abc123');
    });
  });

  describe('getPaperByDoi', () => {
    it('requests paper with DOI prefix', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ paperId: '123' }),
      });

      await getPaperByDoi('10.1234/test.doi');

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('/paper/DOI:');
    });
  });

  describe('getPaperByArxiv', () => {
    it('extracts arxiv ID from full URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ paperId: '123' }),
      });

      await getPaperByArxiv('https://arxiv.org/abs/2301.12345');

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('/paper/ARXIV:2301.12345');
    });

    it('uses direct arxiv ID', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ paperId: '123' }),
      });

      await getPaperByArxiv('2301.12345');

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('/paper/ARXIV:2301.12345');
    });
  });

  describe('getAuthor', () => {
    it('requests author by ID', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ authorId: 'author123', hIndex: 50 }),
      });

      const result = await getAuthor('author123');

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('/author/author123');
      expect(result).toEqual({ authorId: 'author123', hIndex: 50 });
    });
  });
});
