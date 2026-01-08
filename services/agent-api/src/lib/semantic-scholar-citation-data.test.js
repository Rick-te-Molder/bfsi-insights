// @ts-check
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCitationData } from './semantic-scholar-citation-data.js';

// Mock the dependencies
vi.mock('./semantic-scholar-api.js', () => ({
  getPaperByArxiv: vi.fn(),
  getPaperByDoi: vi.fn(),
  searchPaper: vi.fn(),
}));

vi.mock('./semantic-scholar-metrics.js', () => ({
  extractCitationMetrics: vi.fn(),
}));

vi.mock('./semantic-scholar-scoring.js', () => ({
  calculateImpactScore: vi.fn(),
}));

import { getPaperByArxiv, getPaperByDoi, searchPaper } from './semantic-scholar-api.js';
import { extractCitationMetrics } from './semantic-scholar-metrics.js';
import { calculateImpactScore } from './semantic-scholar-scoring.js';

describe('semantic-scholar-citation-data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCitationData', () => {
    const mockPaper = {
      paperId: 'abc123',
      title: 'Test Paper Title',
      citationCount: 100,
    };

    const mockMetrics = {
      citationCount: 100,
      influentialCitations: 10,
      maxAuthorHIndex: 25,
      citationsPerYear: 20,
    };

    it('returns null when no paper is found', async () => {
      getPaperByArxiv.mockResolvedValue(null);
      getPaperByDoi.mockResolvedValue(null);
      searchPaper.mockResolvedValue(null);

      const result = await getCitationData({ title: 'Nonexistent Paper' });

      expect(result).toBeNull();
    });

    it('looks up paper by arxiv ID when provided', async () => {
      getPaperByArxiv.mockResolvedValue(mockPaper);
      extractCitationMetrics.mockReturnValue(mockMetrics);
      calculateImpactScore.mockReturnValue(7);

      const result = await getCitationData({ arxivId: '2301.12345' });

      expect(getPaperByArxiv).toHaveBeenCalledWith('2301.12345');
      expect(result).toEqual({
        paperId: 'abc123',
        title: 'Test Paper Title',
        metrics: mockMetrics,
        impactScore: 7,
      });
    });

    it('extracts arxiv ID from URL', async () => {
      getPaperByArxiv.mockResolvedValue(mockPaper);
      extractCitationMetrics.mockReturnValue(mockMetrics);
      calculateImpactScore.mockReturnValue(7);

      await getCitationData({ url: 'https://arxiv.org/abs/2301.12345' });

      expect(getPaperByArxiv).toHaveBeenCalledWith('2301.12345');
    });

    it('looks up paper by DOI when provided', async () => {
      getPaperByDoi.mockResolvedValue(mockPaper);
      extractCitationMetrics.mockReturnValue(mockMetrics);
      calculateImpactScore.mockReturnValue(8);

      const result = await getCitationData({ doi: '10.1234/test.doi' });

      expect(getPaperByDoi).toHaveBeenCalledWith('10.1234/test.doi');
      expect(result.impactScore).toBe(8);
    });

    it('searches by title when no identifiers provided', async () => {
      searchPaper.mockResolvedValue(mockPaper);
      extractCitationMetrics.mockReturnValue(mockMetrics);
      calculateImpactScore.mockReturnValue(5);

      const result = await getCitationData({ title: 'Machine Learning Paper' });

      expect(searchPaper).toHaveBeenCalledWith('Machine Learning Paper');
      expect(result.title).toBe('Test Paper Title');
    });

    it('prefers arxiv ID over DOI over title', async () => {
      getPaperByArxiv.mockResolvedValue(mockPaper);
      extractCitationMetrics.mockReturnValue(mockMetrics);
      calculateImpactScore.mockReturnValue(7);

      await getCitationData({
        arxivId: '2301.12345',
        doi: '10.1234/test.doi',
        title: 'Some Paper',
      });

      expect(getPaperByArxiv).toHaveBeenCalledWith('2301.12345');
      expect(getPaperByDoi).not.toHaveBeenCalled();
      expect(searchPaper).not.toHaveBeenCalled();
    });

    it('returns null when empty options provided', async () => {
      const result = await getCitationData({});

      expect(result).toBeNull();
    });

    it('extracts metrics and calculates impact score', async () => {
      getPaperByDoi.mockResolvedValue(mockPaper);
      extractCitationMetrics.mockReturnValue(mockMetrics);
      calculateImpactScore.mockReturnValue(9);

      const result = await getCitationData({ doi: '10.1234/test' });

      expect(extractCitationMetrics).toHaveBeenCalledWith(mockPaper);
      expect(calculateImpactScore).toHaveBeenCalledWith(mockMetrics);
      expect(result.metrics).toEqual(mockMetrics);
      expect(result.impactScore).toBe(9);
    });
  });
});
