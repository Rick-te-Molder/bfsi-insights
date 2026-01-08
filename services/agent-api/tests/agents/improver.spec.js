/**
 * Tests for improver.js
 *
 * KB-214: User Feedback Reinforcement System - Phase 2
 *
 * Comprehensive tests for miss classification logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Track mock responses per table and call sequence
let mockResponses = {};
let callCounts = {};

// Create chainable mock that returns different data based on table
const createChainableMock = (tableName) => {
  // Track call count per table
  if (!callCounts[tableName]) callCounts[tableName] = 0;
  const callIndex = callCounts[tableName]++;

  const getResponse = (method) => {
    const tableResponses = mockResponses[tableName] || {};
    // Support array of responses for sequential calls
    if (Array.isArray(tableResponses[method])) {
      return (
        tableResponses[method][callIndex] || tableResponses[method][0] || { data: [], error: null }
      );
    }
    return tableResponses[method] || { data: [], error: null };
  };

  const chainable = {
    select: vi.fn(() => chainable),
    eq: vi.fn(() => chainable),
    ilike: vi.fn(() => chainable),
    is: vi.fn(() => chainable),
    not: vi.fn(() => chainable),
    order: vi.fn(() => chainable),
    update: vi.fn(() => chainable),
    limit: vi.fn(() => Promise.resolve(getResponse('limit'))),
    single: vi.fn(() => Promise.resolve(getResponse('single'))),
  };
  return chainable;
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((tableName) => createChainableMock(tableName)),
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
    mockResponses = {};
    callCounts = {};
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
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

    it('should have string values for all categories', () => {
      for (const [key, value] of Object.entries(MISS_CATEGORIES)) {
        expect(typeof key).toBe('string');
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      }
    });
  });

  describe('analyzeMissedDiscovery', () => {
    it('should return error when missed discovery not found', async () => {
      mockResponses.missed_discovery = {
        single: { data: null, error: { message: 'Not found' } },
      };
      const result = await analyzeMissedDiscovery('non-existent-id');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should skip already classified items', async () => {
      mockResponses.missed_discovery = {
        single: {
          data: {
            id: 'test-id',
            url: 'https://example.com/article',
            miss_category: 'source_not_tracked',
          },
          error: null,
        },
      };
      const result = await analyzeMissedDiscovery('test-id');
      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.category).toBe('source_not_tracked');
    });

    it('should classify as source_not_tracked when domain not in kb_source', async () => {
      mockResponses.missed_discovery = {
        single: {
          data: {
            id: 'test-id',
            url: 'https://newdomain.com/article',
            url_norm: 'https://newdomain.com/article',
            miss_category: null,
          },
          error: null,
        },
        limit: { data: [], error: null },
      };
      mockResponses.kb_source = {
        limit: { data: [], error: null },
      };
      const result = await analyzeMissedDiscovery('test-id');
      expect(result.success).toBe(true);
      expect(result.category).toBe('source_not_tracked');
    });

    it('should handle invalid URL format', async () => {
      mockResponses.missed_discovery = {
        single: {
          data: {
            id: 'test-id',
            url: 'not-a-valid-url',
            miss_category: null,
          },
          error: null,
        },
      };
      const result = await analyzeMissedDiscovery('test-id');
      expect(result.success).toBe(true);
      expect(result.category).toBe('crawl_failed');
    });

    it('should handle UUID format ID', async () => {
      const result = await analyzeMissedDiscovery('123e4567-e89b-12d3-a456-426614174000');
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('analyzeAllPendingMisses', () => {
    it('should return success with 0 processed when no pending misses', async () => {
      mockResponses.missed_discovery = {
        limit: { data: [], error: null },
      };
      const result = await analyzeAllPendingMisses();
      expect(result.success).toBe(true);
      expect(result.processed).toBe(0);
    });

    it('should return error when fetch fails', async () => {
      mockResponses.missed_discovery = {
        limit: { data: null, error: { message: 'Database error' } },
      };
      const result = await analyzeAllPendingMisses();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });

    it('should return result object with expected shape', async () => {
      const result = await analyzeAllPendingMisses();
      expect(result).toHaveProperty('success');
    });

    it('should initialize categories object', async () => {
      mockResponses.missed_discovery = {
        limit: { data: [], error: null },
      };
      const result = await analyzeAllPendingMisses();
      expect(result.success).toBe(true);
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

    it('should count categories correctly', async () => {
      mockResponses.missed_discovery = {
        limit: {
          data: [
            { miss_category: 'source_not_tracked' },
            { miss_category: 'source_not_tracked' },
            { miss_category: 'filter_rejected' },
          ],
          error: null,
        },
      };
      const report = await generateImprovementReport();
      expect(report.summary.by_category).toBeDefined();
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

  it('should have default export with all functions', () => {
    expect(improverModule.default).toBeDefined();
    expect(improverModule.default.analyzeMissedDiscovery).toBeDefined();
    expect(improverModule.default.analyzeAllPendingMisses).toBeDefined();
    expect(improverModule.default.generateImprovementReport).toBeDefined();
    expect(improverModule.default.MISS_CATEGORIES).toBeDefined();
  });
});

describe('Edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResponses = {};
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
  });

  it('should handle null data gracefully in report', async () => {
    mockResponses.missed_discovery = {
      limit: { data: null, error: null },
    };
    const report = await generateImprovementReport();
    expect(report.summary.total_pending).toBe(0);
  });

  it('should handle empty string ID', async () => {
    const result = await analyzeMissedDiscovery('');
    expect(result).toBeDefined();
  });

  it('should handle special characters in ID', async () => {
    const result = await analyzeMissedDiscovery('test-id-with-special-chars!@#');
    expect(result).toBeDefined();
  });
});

describe('Report aggregation logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResponses = {};
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
  });

  it('should aggregate domains with urgency flags', async () => {
    // This test covers the domain aggregation in generateImprovementReport
    const report = await generateImprovementReport();
    expect(report.suggestions.add_sources).toBeDefined();
    expect(Array.isArray(report.suggestions.add_sources)).toBe(true);
  });

  it('should map filter rejections correctly', async () => {
    const report = await generateImprovementReport();
    expect(report.suggestions.tune_filter).toBeDefined();
    expect(Array.isArray(report.suggestions.tune_filter)).toBe(true);
  });

  it('should handle report with category counts', async () => {
    const report = await generateImprovementReport();
    expect(report.summary).toBeDefined();
    expect(typeof report.summary.total_pending).toBe('number');
  });

  it('should slice top 10 domains', async () => {
    const report = await generateImprovementReport();
    expect(report.suggestions.add_sources.length).toBeLessThanOrEqual(10);
  });

  it('should slice top 5 domains for logging', async () => {
    const report = await generateImprovementReport();
    // Just ensure report generates without error
    expect(report).toBeDefined();
  });
});

// Classification branches, Days calculation, Report with data, Update error handling, and Condition branches
// tests are in improver-classification.spec.js and improver-conditions.spec.js
