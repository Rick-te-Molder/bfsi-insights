import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSystemPrompt, getAudiences, getRejectionPatterns } from './scorer-prompt.js';

vi.mock('../clients/supabase.js', () => ({
  getSupabaseAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          data: [
            {
              code: 'executive',
              name: 'Executive',
              description: 'C-suite',
              cares_about: 'ROI',
              doesnt_care_about: 'Code',
              scoring_guide: 'Focus on business impact',
            },
          ],
          error: null,
        })),
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            data: [],
            error: null,
          })),
        })),
      })),
    })),
  })),
}));

describe('scorer-prompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSystemPrompt', () => {
    it('should generate system prompt from database', async () => {
      const prompt = await getSystemPrompt();

      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe('string');
      expect(prompt).toContain('Executive');
      expect(prompt).toContain('SCORING GUIDELINES');
      expect(prompt).toContain('RESPONSE FORMAT');
    });

    it('should include audience information in prompt', async () => {
      const prompt = await getSystemPrompt();

      expect(prompt).toContain('executive');
      expect(prompt).toContain('C-suite');
    });

    it('should include scoring guidelines', async () => {
      const prompt = await getSystemPrompt();

      expect(prompt).toContain('Score 8-10');
      expect(prompt).toContain('Score 5-7');
      expect(prompt).toContain('Score 3-4');
      expect(prompt).toContain('Score 1-2');
    });

    it('should include response format', async () => {
      const prompt = await getSystemPrompt();

      expect(prompt).toContain('relevance_scores');
      expect(prompt).toContain('primary_audience');
      expect(prompt).toContain('executive_summary');
    });
  });

  describe('getAudiences', () => {
    it('should load audiences from database', async () => {
      const audiences = await getAudiences();

      expect(audiences).toBeDefined();
      expect(Array.isArray(audiences)).toBe(true);
      expect(audiences.length).toBeGreaterThan(0);
    });
  });

  describe('getRejectionPatterns', () => {
    it('should load rejection patterns from database', async () => {
      const patterns = await getRejectionPatterns();

      expect(patterns).toBeDefined();
      expect(Array.isArray(patterns)).toBe(true);
    });
  });
});
