import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runDiscoveryCmd, runClassicsCmd } from '../../../src/cli/commands/discovery.js';
import * as discoverer from '../../../src/agents/discoverer.js';
import * as discoverClassics from '../../../src/agents/discover-classics.js';

vi.mock('../../../src/agents/discoverer.js');
vi.mock('../../../src/agents/discover-classics.js');

describe('Discovery CLI Commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('runDiscoveryCmd', () => {
    it('should call runDiscovery with correct options', async () => {
      const mockResult = { found: 10, new: 5, retried: 2, skipped: 1 };
      vi.mocked(discoverer.runDiscovery).mockResolvedValue(mockResult);

      const options = {
        source: 'test-source',
        limit: 10,
        'dry-run': true,
        agentic: true,
        hybrid: false,
        premium: true,
      };

      const result = await runDiscoveryCmd(options);

      expect(discoverer.runDiscovery).toHaveBeenCalledWith({
        source: 'test-source',
        limit: 10,
        dryRun: true,
        agentic: true,
        hybrid: false,
        premium: true,
      });
      expect(result).toEqual(mockResult);
    });

    it('should handle dryRun option variant', async () => {
      const mockResult = { found: 5, new: 3 };
      vi.mocked(discoverer.runDiscovery).mockResolvedValue(mockResult);

      const options = { dryRun: true };
      await runDiscoveryCmd(options);

      expect(discoverer.runDiscovery).toHaveBeenCalledWith(
        expect.objectContaining({ dryRun: true }),
      );
    });

    it('should default agentic, hybrid, and premium to false', async () => {
      const mockResult = { found: 0, new: 0 };
      vi.mocked(discoverer.runDiscovery).mockResolvedValue(mockResult);

      await runDiscoveryCmd({});

      expect(discoverer.runDiscovery).toHaveBeenCalledWith(
        expect.objectContaining({
          agentic: false,
          hybrid: false,
          premium: false,
        }),
      );
    });

    it('should log results without skipped when not present', async () => {
      const mockResult = { found: 10, new: 5 };
      vi.mocked(discoverer.runDiscovery).mockResolvedValue(mockResult);

      await runDiscoveryCmd({});

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Found: 10, New: 5'));
    });
  });

  describe('runClassicsCmd', () => {
    it('should call runClassicsDiscovery with correct options', async () => {
      const mockResult = { classics: 5, expansions: 10 };
      vi.mocked(discoverClassics.runClassicsDiscovery).mockResolvedValue(mockResult);

      const options = {
        limit: 10,
        'no-expand': false,
        'dry-run': true,
      };

      const result = await runClassicsCmd(options);

      expect(discoverClassics.runClassicsDiscovery).toHaveBeenCalledWith({
        limit: 10,
        expandCitations: true,
        dryRun: true,
      });
      expect(result).toEqual(mockResult);
    });

    it('should default limit to 5', async () => {
      const mockResult = { classics: 3, expansions: 7 };
      vi.mocked(discoverClassics.runClassicsDiscovery).mockResolvedValue(mockResult);

      await runClassicsCmd({});

      expect(discoverClassics.runClassicsDiscovery).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 5 }),
      );
    });

    it('should handle no-expand option', async () => {
      const mockResult = { classics: 2, expansions: 0 };
      vi.mocked(discoverClassics.runClassicsDiscovery).mockResolvedValue(mockResult);

      await runClassicsCmd({ 'no-expand': true });

      expect(discoverClassics.runClassicsDiscovery).toHaveBeenCalledWith(
        expect.objectContaining({ expandCitations: false }),
      );
    });

    it('should log results', async () => {
      const mockResult = { classics: 5, expansions: 10 };
      vi.mocked(discoverClassics.runClassicsDiscovery).mockResolvedValue(mockResult);

      await runClassicsCmd({});

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Classics queued: 5'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Expansion papers: 10'));
    });
  });
});
