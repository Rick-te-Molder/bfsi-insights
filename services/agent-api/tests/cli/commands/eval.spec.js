import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runEvalCmd, runEvalHistoryCmd } from '../../../src/cli/commands/eval.js';
import * as evals from '../../../src/lib/evals.js';

vi.mock('../../../src/agents/screener.js');
vi.mock('../../../src/agents/summarizer.js');
vi.mock('../../../src/agents/tagger.js');
vi.mock('../../../src/lib/evals.js');
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => ({ data: [] })),
        })),
      })),
    })),
  })),
}));

describe('Eval CLI Commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(() => {});
  });

  describe('runEvalCmd', () => {
    it('should exit if no agent specified', async () => {
      await runEvalCmd({});
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should exit if unknown agent specified', async () => {
      await runEvalCmd({ agent: 'unknown' });
      expect(console.error).toHaveBeenCalledWith('Unknown agent: unknown');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should run golden eval for screener', async () => {
      vi.mocked(evals.runGoldenEval).mockResolvedValue(undefined);

      await runEvalCmd({ agent: 'screener', type: 'golden', limit: 50 });

      expect(evals.runGoldenEval).toHaveBeenCalledWith('screener', expect.any(Function), {
        limit: 50,
      });
    });

    it('should run golden eval for summarizer', async () => {
      vi.mocked(evals.runGoldenEval).mockResolvedValue(undefined);

      await runEvalCmd({ agent: 'summarizer' });

      expect(evals.runGoldenEval).toHaveBeenCalledWith('summarizer', expect.any(Function), {
        limit: 100,
      });
    });

    it('should run golden eval for tagger', async () => {
      vi.mocked(evals.runGoldenEval).mockResolvedValue(undefined);

      await runEvalCmd({ agent: 'tagger', type: 'golden' });

      expect(evals.runGoldenEval).toHaveBeenCalledWith('tagger', expect.any(Function), {
        limit: 100,
      });
    });

    it('should default to golden eval type', async () => {
      vi.mocked(evals.runGoldenEval).mockResolvedValue(undefined);

      await runEvalCmd({ agent: 'screener' });

      expect(evals.runGoldenEval).toHaveBeenCalled();
    });

    it('should run judge eval when specified', async () => {
      vi.mocked(evals.runLLMJudgeEval).mockResolvedValue(undefined);

      await runEvalCmd({ agent: 'screener', type: 'judge', limit: 5 });

      expect(evals.runLLMJudgeEval).toHaveBeenCalledWith('screener', expect.any(Function), []);
    });
  });

  describe('runEvalHistoryCmd', () => {
    it('should exit if no agent specified', async () => {
      await runEvalHistoryCmd({});
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should display eval history', async () => {
      const mockHistory = [
        {
          started_at: '2026-01-01T10:00:00Z',
          eval_type: 'golden',
          prompt_version: 'v1.0',
          score: 0.85,
        },
        {
          started_at: '2026-01-02T10:00:00Z',
          eval_type: 'judge',
          prompt_version: 'v1.1',
          score: 0.92,
        },
      ];
      vi.mocked(evals.getEvalHistory).mockResolvedValue(mockHistory);

      await runEvalHistoryCmd({ agent: 'screener', limit: 5 });

      expect(evals.getEvalHistory).toHaveBeenCalledWith('screener', 5);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Eval History for screener'),
      );
    });

    it('should handle empty history', async () => {
      vi.mocked(evals.getEvalHistory).mockResolvedValue([]);

      await runEvalHistoryCmd({ agent: 'tagger' });

      expect(console.log).toHaveBeenCalledWith('No eval runs found');
    });

    it('should default limit to 10', async () => {
      vi.mocked(evals.getEvalHistory).mockResolvedValue([]);

      await runEvalHistoryCmd({ agent: 'summarizer' });

      expect(evals.getEvalHistory).toHaveBeenCalledWith('summarizer', 10);
    });
  });
});
