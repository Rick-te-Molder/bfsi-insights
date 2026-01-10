import { describe, it, expect, vi } from 'vitest';
import { loadWritingRules } from '../../src/agents/summarizer.writing-rules.js';

describe('agents/summarizer.writing-rules', () => {
  describe('loadWritingRules', () => {
    it('returns empty string when no rules exist', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null }),
      };

      const result = await loadWritingRules(mockSupabase);

      expect(result).toBe('');
    });

    it('returns empty string for empty rules array', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [] }),
      };

      const result = await loadWritingRules(mockSupabase);

      expect(result).toBe('');
    });

    it('groups rules by category', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            { category: 'style', rule_name: 'Rule1', rule_text: 'Be concise' },
            { category: 'style', rule_name: 'Rule2', rule_text: 'Use active voice' },
            { category: 'format', rule_name: 'Rule3', rule_text: 'Use bullet points' },
          ],
        }),
      };

      const result = await loadWritingRules(mockSupabase);

      expect(result).toContain('## STYLE RULES');
      expect(result).toContain('## FORMAT RULES');
      expect(result).toContain('• Rule1: Be concise');
      expect(result).toContain('• Rule2: Use active voice');
      expect(result).toContain('• Rule3: Use bullet points');
    });

    it('queries writing_rules table with correct parameters', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [] }),
      };

      await loadWritingRules(mockSupabase);

      expect(mockSupabase.from).toHaveBeenCalledWith('writing_rules');
      expect(mockSupabase.select).toHaveBeenCalledWith('category, rule_name, rule_text');
      expect(mockSupabase.eq).toHaveBeenCalledWith('is_active', true);
      expect(mockSupabase.order).toHaveBeenCalledWith('priority', { ascending: false });
    });
  });
});
