import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseValue,
  parseArgs,
  getStatusIcon,
  categorizePendingByAge,
  printPendingBreakdown,
} from '../../src/cli/utils.js';

describe('CLI Utils', () => {
  describe('parseValue', () => {
    it('should parse numeric strings to numbers', () => {
      expect(parseValue('123')).toBe(123);
      expect(parseValue('0')).toBe(0);
      expect(parseValue('999')).toBe(999);
    });

    it('should return non-numeric strings as-is', () => {
      expect(parseValue('hello')).toBe('hello');
      expect(parseValue('test-value')).toBe('test-value');
      expect(parseValue('123abc')).toBe('123abc');
    });

    it('should handle empty strings', () => {
      expect(parseValue('')).toBe('');
    });
  });

  describe('parseArgs', () => {
    let originalArgv;

    beforeEach(() => {
      originalArgv = process.argv;
    });

    afterEach(() => {
      process.argv = originalArgv;
    });

    it('should parse command with no options', () => {
      process.argv = ['node', 'cli.js', 'health'];
      const result = parseArgs();
      expect(result).toEqual({ command: 'health', options: {} });
    });

    it('should parse options with = syntax', () => {
      process.argv = ['node', 'cli.js', 'discovery', '--limit=10', '--source=test'];
      const result = parseArgs();
      expect(result).toEqual({
        command: 'discovery',
        options: { limit: 10, source: 'test' },
      });
    });

    it('should parse options with space syntax', () => {
      process.argv = ['node', 'cli.js', 'eval', '--agent', 'screener', '--limit', '50'];
      const result = parseArgs();
      expect(result).toEqual({
        command: 'eval',
        options: { agent: 'screener', limit: 50 },
      });
    });

    it('should parse boolean flags', () => {
      process.argv = ['node', 'cli.js', 'discovery', '--dry-run', '--agentic'];
      const result = parseArgs();
      expect(result).toEqual({
        command: 'discovery',
        options: { 'dry-run': true, agentic: true },
      });
    });

    it('should handle mixed option formats', () => {
      process.argv = ['node', 'cli.js', 'process', '--limit=100', '--dry-run', '--agent', 'tagger'];
      const result = parseArgs();
      expect(result).toEqual({
        command: 'process',
        options: { limit: 100, 'dry-run': true, agent: 'tagger' },
      });
    });

    it('should handle values with = in them', () => {
      process.argv = ['node', 'cli.js', 'test', '--url=https://example.com?param=value'];
      const result = parseArgs();
      expect(result).toEqual({
        command: 'test',
        options: { url: 'https://example.com?param=value' },
      });
    });
  });

  describe('getStatusIcon', () => {
    it('should return correct icons for known statuses', () => {
      expect(getStatusIcon('pending')).toBe('⏳');
      expect(getStatusIcon('enriched')).toBe('✅');
      expect(getStatusIcon('rejected')).toBe('❌');
    });

    it('should return default icon for unknown statuses', () => {
      expect(getStatusIcon('unknown')).toBe('📝');
      expect(getStatusIcon('custom')).toBe('📝');
    });
  });

  describe('categorizePendingByAge', () => {
    it('should categorize items by age buckets', () => {
      const now = new Date();
      const pending = [
        {
          discovered_at: new Date(now - 12 * 60 * 60 * 1000).toISOString(),
          payload: { source: 'rss' },
        }, // 12h ago
        {
          discovered_at: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
          payload: { source: 'sitemap' },
        }, // 3 days ago
        {
          discovered_at: new Date(now - 15 * 24 * 60 * 60 * 1000).toISOString(),
          payload: { source: 'rss' },
        }, // 15 days ago
        {
          discovered_at: new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString(),
          payload: { source: 'manual' },
        }, // 40 days ago
      ];

      const result = categorizePendingByAge(pending);

      expect(result.buckets.last_24h).toBe(1);
      expect(result.buckets.last_week).toBe(1);
      expect(result.buckets.last_month).toBe(1);
      expect(result.buckets.older).toBe(1);
    });

    it('should count items by source', () => {
      const now = new Date();
      const pending = [
        { discovered_at: now.toISOString(), payload: { source: 'rss' } },
        { discovered_at: now.toISOString(), payload: { source: 'rss' } },
        { discovered_at: now.toISOString(), payload: { source: 'sitemap' } },
        { discovered_at: now.toISOString(), payload: {} }, // no source
      ];

      const result = categorizePendingByAge(pending);

      expect(result.sourceCount.rss).toBe(2);
      expect(result.sourceCount.sitemap).toBe(1);
      expect(result.sourceCount.unknown).toBe(1);
    });

    it('should handle empty pending array', () => {
      const result = categorizePendingByAge([]);

      expect(result.buckets).toEqual({
        last_24h: 0,
        last_week: 0,
        last_month: 0,
        older: 0,
      });
      expect(result.sourceCount).toEqual({});
    });
  });

  describe('printPendingBreakdown', () => {
    beforeEach(() => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    it('should print age buckets', () => {
      const now = new Date();
      const pending = [
        {
          discovered_at: new Date(now - 12 * 60 * 60 * 1000).toISOString(),
          payload: { source: 'rss', title: 'Test Article' },
        },
      ];

      printPendingBreakdown(pending);

      expect(console.log).toHaveBeenCalledWith('   By age:');
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Last 24h:'));
    });

    it('should print source breakdown', () => {
      const now = new Date();
      const pending = [
        { discovered_at: now.toISOString(), payload: { source: 'rss', title: 'Article 1' } },
        { discovered_at: now.toISOString(), payload: { source: 'rss', title: 'Article 2' } },
        { discovered_at: now.toISOString(), payload: { source: 'sitemap', title: 'Article 3' } },
      ];

      printPendingBreakdown(pending);

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('By source (top 5)'));
    });

    it('should print oldest pending item info', () => {
      const now = new Date();
      const pending = [
        {
          discovered_at: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
          payload: { source: 'rss', title: 'Very Old Article That Should Be Truncated' },
        },
      ];

      printPendingBreakdown(pending);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Oldest pending: 10 days old'),
      );
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Very Old Article'));
    });

    it('should handle empty pending array', () => {
      printPendingBreakdown([]);

      expect(console.log).toHaveBeenCalledWith('   By age:');
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Last 24h:  0'));
    });

    it('should limit source display to top 5', () => {
      const now = new Date();
      const pending = Array.from({ length: 10 }, (_, i) => ({
        discovered_at: now.toISOString(),
        payload: { source: `source-${i}`, title: 'Article' },
      }));

      printPendingBreakdown(pending);

      // Should only print top 5 sources
      const logCalls = console.log.mock.calls.map((call) => call[0]);
      const sourceLines = logCalls.filter((line) => line && line.includes('source-'));
      expect(sourceLines.length).toBeLessThanOrEqual(5);
    });
  });
});
