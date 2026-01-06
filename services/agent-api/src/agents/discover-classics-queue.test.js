// @ts-check
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/status-codes.js', () => ({
  loadStatusCodes: vi.fn(() => Promise.resolve()),
  STATUS: { PENDING_ENRICHMENT: 200 },
}));

vi.mock('../lib/semantic-scholar.js', () => ({
  calculateImpactScore: vi.fn(() => 8),
  extractCitationMetrics: vi.fn(() => ({ citationCount: 1000, influentialCitations: 50 })),
}));

vi.mock('./discover-classics-db.js', () => ({
  urlExists: vi.fn(() => Promise.resolve(false)),
  insertQueueItem: vi.fn(() => Promise.resolve({ data: { id: 'new-1' }, error: null })),
}));

import { queuePaper } from './discover-classics-queue.js';
import { urlExists, insertQueueItem } from './discover-classics-db.js';

describe('discover-classics-queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('queuePaper', () => {
    const mockPaper = {
      paperId: 'semantic-123',
      title: 'Test Paper',
      url: 'https://semanticscholar.org/paper/123',
      year: 2020,
      authors: [{ name: 'Author 1' }, { name: 'Author 2' }],
    };

    const mockClassic = {
      id: 'classic-1',
      title: 'Classic Paper',
      significance: 'Foundational work',
    };

    it('queues new paper and returns queued action', async () => {
      vi.mocked(urlExists).mockResolvedValue(false);
      vi.mocked(insertQueueItem).mockResolvedValue({ data: { id: 'queue-1' }, error: null });

      const result = await queuePaper(mockPaper, mockClassic, true);

      expect(result.action).toBe('queued');
      expect(result.id).toBe('queue-1');
      expect(insertQueueItem).toHaveBeenCalled();
    });

    it('returns exists if URL already exists', async () => {
      vi.mocked(urlExists).mockResolvedValue(true);

      const result = await queuePaper(mockPaper, mockClassic, true);

      expect(result.action).toBe('exists');
      expect(insertQueueItem).not.toHaveBeenCalled();
    });

    it('returns exists on duplicate key constraint', async () => {
      vi.mocked(urlExists).mockResolvedValue(false);
      vi.mocked(insertQueueItem).mockResolvedValue({ data: null, error: { code: '23505' } });

      const result = await queuePaper(mockPaper, mockClassic, true);

      expect(result.action).toBe('exists');
    });

    it('throws on other database errors', async () => {
      vi.mocked(urlExists).mockResolvedValue(false);
      vi.mocked(insertQueueItem).mockResolvedValue({ data: null, error: new Error('DB error') });

      await expect(queuePaper(mockPaper, mockClassic, true)).rejects.toThrow('DB error');
    });

    it('uses semantic scholar URL if paper.url not provided', async () => {
      const paperWithoutUrl = { ...mockPaper, url: undefined };
      vi.mocked(urlExists).mockResolvedValue(false);
      vi.mocked(insertQueueItem).mockResolvedValue({ data: { id: 'queue-1' }, error: null });

      await queuePaper(paperWithoutUrl, mockClassic, true);

      expect(urlExists).toHaveBeenCalledWith('https://www.semanticscholar.org/paper/semantic-123');
    });

    it('builds payload with classic paper source', async () => {
      vi.mocked(urlExists).mockResolvedValue(false);
      vi.mocked(insertQueueItem).mockResolvedValue({ data: { id: 'queue-1' }, error: null });

      await queuePaper(mockPaper, mockClassic, true);

      expect(insertQueueItem).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            source: 'classic-paper',
            source_classic_id: 'classic-1',
          }),
        }),
      );
    });

    it('builds payload with citation-expansion source', async () => {
      vi.mocked(urlExists).mockResolvedValue(false);
      vi.mocked(insertQueueItem).mockResolvedValue({ data: { id: 'queue-1' }, error: null });

      await queuePaper(mockPaper, mockClassic, false);

      expect(insertQueueItem).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            source: 'citation-expansion',
          }),
        }),
      );
    });

    it('includes authors in payload', async () => {
      vi.mocked(urlExists).mockResolvedValue(false);
      vi.mocked(insertQueueItem).mockResolvedValue({ data: { id: 'queue-1' }, error: null });

      await queuePaper(mockPaper, mockClassic, true);

      expect(insertQueueItem).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            authors: ['Author 1', 'Author 2'],
          }),
        }),
      );
    });

    it('handles paper with no authors', async () => {
      const paperNoAuthors = { ...mockPaper, authors: undefined };
      vi.mocked(urlExists).mockResolvedValue(false);
      vi.mocked(insertQueueItem).mockResolvedValue({ data: { id: 'queue-1' }, error: null });

      await queuePaper(paperNoAuthors, mockClassic, true);

      expect(insertQueueItem).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            authors: [],
          }),
        }),
      );
    });
  });
});
