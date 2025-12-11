/**
 * Tests for improver.js
 *
 * KB-214: User Feedback Reinforcement System - Phase 2
 *
 * Focus:
 * - Miss classification logic
 * - Domain extraction
 * - Days calculation
 * - Report generation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase with proper chaining
const createMockQuery = () => {
  const mockResult = { data: [], error: null };
  const mockSingle = { data: null, error: null };

  const chainable = {
    select: vi.fn(() => chainable),
    eq: vi.fn(() => chainable),
    ilike: vi.fn(() => chainable),
    is: vi.fn(() => chainable),
    not: vi.fn(() => chainable),
    order: vi.fn(() => chainable),
    limit: vi.fn(() => Promise.resolve(mockResult)),
    single: vi.fn(() => Promise.resolve(mockSingle)),
    maybeSingle: vi.fn(() => Promise.resolve(mockSingle)),
  };
  return chainable;
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => createMockQuery()),
  })),
}));

// Import after mocking
const improverModule = await import('../../src/agents/improver.js');
const {
  analyzeMissedDiscovery,
  analyzeAllPendingMisses,
  generateImprovementReport,
  MISS_CATEGORIES,
} = improverModule.default || improverModule;

describe('Improver Agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('MISS_CATEGORIES', () => {
    it('should define all miss categories', () => {
      expect(MISS_CATEGORIES).toBeDefined();
      expect(MISS_CATEGORIES.source_not_tracked).toBe('Domain is not in our kb_source table');
      expect(MISS_CATEGORIES.pattern_missing).toBe('Source is tracked but URL pattern not covered');
      expect(MISS_CATEGORIES.pattern_wrong).toBe('Pattern exists but did not match this URL');
      expect(MISS_CATEGORIES.filter_rejected).toBe('Found but scored below threshold');
      expect(MISS_CATEGORIES.crawl_failed).toBe('Technical failure (JS rendering, paywall, etc)');
      expect(MISS_CATEGORIES.too_slow).toBe('Found it but days after publication');
      expect(MISS_CATEGORIES.link_not_followed).toBe('Was linked from a page we crawled');
      expect(MISS_CATEGORIES.dynamic_content).toBe('Content is JS-rendered, not in static HTML');
    });

    it('should have exactly 8 categories', () => {
      expect(Object.keys(MISS_CATEGORIES)).toHaveLength(8);
    });
  });

  describe('analyzeMissedDiscovery', () => {
    it('should return error when missed discovery not found', async () => {
      const result = await analyzeMissedDiscovery('non-existent-id');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle UUID format ID', async () => {
      const result = await analyzeMissedDiscovery('123e4567-e89b-12d3-a456-426614174000');
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('analyzeAllPendingMisses', () => {
    it('should return success with 0 processed when no pending misses', async () => {
      const result = await analyzeAllPendingMisses();
      expect(result.success).toBe(true);
      expect(result.processed).toBe(0);
    });

    it('should return result object with expected shape', async () => {
      const result = await analyzeAllPendingMisses();
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('processed');
    });
  });

  describe('generateImprovementReport', () => {
    it('should generate a report with timestamp', async () => {
      const report = await generateImprovementReport();
      expect(report).toBeDefined();
      expect(report.generated_at).toBeDefined();
      expect(new Date(report.generated_at).toString()).not.toBe('Invalid Date');
    });

    it('should include summary with total_pending and by_category', async () => {
      const report = await generateImprovementReport();
      expect(report.summary).toBeDefined();
      expect(report.summary.total_pending).toBeDefined();
      expect(typeof report.summary.total_pending).toBe('number');
      expect(report.summary.by_category).toBeDefined();
      expect(typeof report.summary.by_category).toBe('object');
    });

    it('should include suggestions for add_sources and tune_filter', async () => {
      const report = await generateImprovementReport();
      expect(report.suggestions).toBeDefined();
      expect(report.suggestions.add_sources).toBeDefined();
      expect(report.suggestions.tune_filter).toBeDefined();
      expect(Array.isArray(report.suggestions.add_sources)).toBe(true);
      expect(Array.isArray(report.suggestions.tune_filter)).toBe(true);
    });

    it('should have empty arrays when no data', async () => {
      const report = await generateImprovementReport();
      expect(report.suggestions.add_sources).toEqual([]);
      expect(report.suggestions.tune_filter).toEqual([]);
    });
  });
});

describe('Module exports', () => {
  it('should export analyzeMissedDiscovery function', () => {
    expect(typeof analyzeMissedDiscovery).toBe('function');
  });

  it('should export analyzeAllPendingMisses function', () => {
    expect(typeof analyzeAllPendingMisses).toBe('function');
  });

  it('should export generateImprovementReport function', () => {
    expect(typeof generateImprovementReport).toBe('function');
  });

  it('should export MISS_CATEGORIES object', () => {
    expect(typeof MISS_CATEGORIES).toBe('object');
  });
});
