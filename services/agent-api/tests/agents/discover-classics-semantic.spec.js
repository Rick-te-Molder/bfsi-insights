import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/semantic-scholar.js', () => ({
  apiRequest: vi.fn(),
  getPaper: vi.fn(),
  searchPaper: vi.fn(),
}));

import {
  sleep,
  lookupClassicPaper,
  getCitingPapers,
  API_DELAY_MS,
} from '../../src/agents/discover-classics-semantic.js';
import { apiRequest, getPaper, searchPaper } from '../../src/lib/semantic-scholar.js';

describe('agents/discover-classics-semantic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constants', () => {
    it('has API_DELAY_MS of 500', () => {
      expect(API_DELAY_MS).toBe(500);
    });
  });

  describe('sleep', () => {
    it('resolves after specified ms', async () => {
      const start = Date.now();
      await sleep(50);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(45);
    });
  });

  describe('lookupClassicPaper', () => {
    it('looks up by DOI first', async () => {
      const paper = { paperId: 'paper-1', title: 'Test Paper' };
      getPaper.mockResolvedValueOnce(paper);

      const result = await lookupClassicPaper({ doi: '10.1234/test' });

      expect(getPaper).toHaveBeenCalledWith('DOI:10.1234/test');
      expect(result).toEqual(paper);
    });

    it('looks up by arXiv ID if DOI not found', async () => {
      const paper = { paperId: 'paper-2', title: 'ArXiv Paper' };
      getPaper.mockResolvedValueOnce(null);
      getPaper.mockResolvedValueOnce(paper);

      const result = await lookupClassicPaper({ doi: '10.1234/test', arxiv_id: '2401.00001' });

      expect(getPaper).toHaveBeenCalledWith('DOI:10.1234/test');
      expect(getPaper).toHaveBeenCalledWith('ARXIV:2401.00001');
      expect(result).toEqual(paper);
    });

    it('falls back to title search', async () => {
      const paper = { paperId: 'paper-3', title: 'Search Result' };
      searchPaper.mockResolvedValueOnce(paper);

      const result = await lookupClassicPaper({ title: 'Search Term' });

      expect(searchPaper).toHaveBeenCalledWith('Search Term');
      expect(result).toEqual(paper);
    });

    it('tries all methods in order', async () => {
      getPaper.mockResolvedValue(null);
      searchPaper.mockResolvedValueOnce(null);

      await lookupClassicPaper({ doi: '10.1234/test', arxiv_id: '2401.00001', title: 'Title' });

      expect(getPaper).toHaveBeenCalledTimes(2);
      expect(searchPaper).toHaveBeenCalledTimes(1);
    });
  });

  describe('getCitingPapers', () => {
    it('returns citing papers', async () => {
      const citations = {
        data: [
          { citingPaper: { paperId: 'cite-1', title: 'Citing 1' } },
          { citingPaper: { paperId: 'cite-2', title: 'Citing 2' } },
        ],
      };
      apiRequest.mockResolvedValueOnce(citations);

      const result = await getCitingPapers('paper-id', 10);

      expect(apiRequest).toHaveBeenCalledWith('/paper/paper-id/citations', {
        fields: 'paperId,title,year,citationCount,influentialCitationCount,authors,url',
        limit: '10',
      });
      expect(result).toHaveLength(2);
      expect(result[0].paperId).toBe('cite-1');
    });

    it('filters out null citing papers', async () => {
      const citations = {
        data: [
          { citingPaper: { paperId: 'cite-1' } },
          { citingPaper: null },
          { citingPaper: { paperId: 'cite-2' } },
        ],
      };
      apiRequest.mockResolvedValueOnce(citations);

      const result = await getCitingPapers('paper-id', 10);

      expect(result).toHaveLength(2);
    });

    it('returns empty array when no data', async () => {
      apiRequest.mockResolvedValueOnce(null);

      const result = await getCitingPapers('paper-id', 10);

      expect(result).toEqual([]);
    });

    it('returns empty array when data array is empty', async () => {
      apiRequest.mockResolvedValueOnce({ data: [] });

      const result = await getCitingPapers('paper-id', 10);

      expect(result).toEqual([]);
    });
  });
});
