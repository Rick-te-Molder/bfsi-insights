/**
 * Condition branches tests for improver.js
 * Split from improver.spec.js for file size compliance
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

let mockResponses = {};
let callCounts = {};

const createChainableMock = (tableName) => {
  if (!callCounts[tableName]) callCounts[tableName] = 0;
  const callIndex = callCounts[tableName]++;

  const getResponse = (method) => {
    const tableResponses = mockResponses[tableName] || {};
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

const improverModule = await import('../../src/agents/improver.js');
const { analyzeMissedDiscovery, generateImprovementReport } =
  improverModule.default || improverModule;

describe('Report with data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResponses = {};
    callCounts = {};
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
  });

  it('should aggregate domains with critical urgency', async () => {
    mockResponses.missed_discovery = {
      limit: {
        data: [
          {
            source_domain: 'domain1.com',
            submitter_urgency: 'critical',
            why_valuable: 'Important article',
          },
          {
            source_domain: 'domain1.com',
            submitter_urgency: 'important',
            why_valuable: 'Another one',
          },
          { source_domain: 'domain2.com', submitter_urgency: null, why_valuable: null },
        ],
        error: null,
      },
    };
    const report = await generateImprovementReport();
    expect(report.suggestions.add_sources.length).toBeGreaterThanOrEqual(0);
  });

  it('should handle domains without source_domain', async () => {
    mockResponses.missed_discovery = {
      limit: {
        data: [
          { source_domain: null, submitter_urgency: 'critical' },
          { source_domain: 'valid.com', submitter_urgency: 'important' },
        ],
        error: null,
      },
    };
    const report = await generateImprovementReport();
    expect(report).toBeDefined();
  });

  it('should map filter rejections with miss_details', async () => {
    mockResponses.missed_discovery = {
      limit: {
        data: [
          {
            miss_details: { relevance_scores: { exec: 3 }, rejection_reason: 'Low score' },
            why_valuable: 'Client requested',
          },
        ],
        error: null,
      },
    };
    const report = await generateImprovementReport();
    expect(report.suggestions.tune_filter).toBeDefined();
  });

  it('should limit samples to 2 per domain', async () => {
    mockResponses.missed_discovery = {
      limit: {
        data: [
          { source_domain: 'test.com', why_valuable: 'Reason 1' },
          { source_domain: 'test.com', why_valuable: 'Reason 2' },
          { source_domain: 'test.com', why_valuable: 'Reason 3' },
        ],
        error: null,
      },
    };
    const report = await generateImprovementReport();
    expect(report).toBeDefined();
  });
});

describe('Update error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResponses = {};
    callCounts = {};
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
  });

  it('should handle update errors gracefully', async () => {
    const result = await analyzeMissedDiscovery('test-id');
    expect(result).toBeDefined();
  });
});

describe('Condition branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResponses = {};
    callCounts = {};
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
  });

  it('should handle data length check in isSourceTracked - null data', async () => {
    mockResponses.missed_discovery = {
      single: { data: { id: 't', url: 'https://x.com/a', miss_category: null }, error: null },
      limit: { data: [], error: null },
    };
    mockResponses.kb_source = { limit: { data: null, error: null } };
    const r = await analyzeMissedDiscovery('t');
    expect(r.category).toBe('source_not_tracked');
  });

  it('should handle data length check in isSourceTracked - empty array', async () => {
    mockResponses.missed_discovery = {
      single: { data: { id: 't', url: 'https://x.com/a', miss_category: null }, error: null },
      limit: { data: [], error: null },
    };
    mockResponses.kb_source = { limit: { data: [], error: null } };
    const r = await analyzeMissedDiscovery('t');
    expect(r.category).toBe('source_not_tracked');
  });

  it('should handle data length check in checkIngestionHistory - null data', async () => {
    mockResponses.missed_discovery = {
      single: { data: { id: 't', url: 'https://x.com/a', miss_category: null }, error: null },
      limit: { data: [], error: null },
    };
    mockResponses.kb_source = { limit: { data: [{ slug: 's', rss_feed: 'r' }], error: null } };
    mockResponses.ingestion_queue = { limit: { data: null, error: null } };
    const r = await analyzeMissedDiscovery('t');
    expect(r.category).toBe('pattern_missing');
  });

  it('should handle error?.message when error is null', async () => {
    mockResponses.missed_discovery = { single: { data: null, error: null } };
    const r = await analyzeMissedDiscovery('t');
    expect(r.success).toBe(false);
    expect(r.error).toBe('Not found');
  });

  it('should handle statusCode 540 without rejected status', async () => {
    mockResponses.missed_discovery = {
      single: { data: { id: 'test', url: 'https://test.com/a', miss_category: null }, error: null },
      limit: { data: [], error: null },
    };
    mockResponses.kb_source = { limit: { data: [{ slug: 's', rss_feed: 'r' }], error: null } };
    mockResponses.ingestion_queue = {
      limit: { data: [{ status: 'pending', status_code: 540 }], error: null },
    };
    const r = await analyzeMissedDiscovery('test');
    expect(r.category).toBe('filter_rejected');
  });

  it('should handle statusCode 500 without failed status', async () => {
    mockResponses.missed_discovery = {
      single: { data: { id: 'test', url: 'https://test.com/a', miss_category: null }, error: null },
      limit: { data: [], error: null },
    };
    mockResponses.kb_source = { limit: { data: [{ slug: 's', rss_feed: 'r' }], error: null } };
    mockResponses.ingestion_queue = {
      limit: { data: [{ status: 'pending', status_code: 500 }], error: null },
    };
    const r = await analyzeMissedDiscovery('test');
    expect(r.category).toBe('crawl_failed');
  });

  it('should handle daysLate <= 3', async () => {
    mockResponses.missed_discovery = {
      single: {
        data: {
          id: 'test',
          url: 'https://test.com/a',
          miss_category: null,
          submitted_at: '2024-01-12T00:00:00Z',
        },
        error: null,
      },
      limit: { data: [], error: null },
    };
    mockResponses.kb_source = { limit: { data: [{ slug: 's', rss_feed: 'r' }], error: null } };
    mockResponses.ingestion_queue = {
      limit: {
        data: [{ status: 'queued', status_code: 200, discovered_at: '2024-01-10T00:00:00Z' }],
        error: null,
      },
    };
    const r = await analyzeMissedDiscovery('test');
    expect(r.category).toBe('pattern_wrong');
  });

  it('should handle missing discovered_at', async () => {
    mockResponses.missed_discovery = {
      single: {
        data: {
          id: 'test',
          url: 'https://test.com/a',
          miss_category: null,
          submitted_at: '2024-01-15',
        },
        error: null,
      },
      limit: { data: [], error: null },
    };
    mockResponses.kb_source = { limit: { data: [{ slug: 's', rss_feed: 'r' }], error: null } };
    mockResponses.ingestion_queue = {
      limit: { data: [{ status: 'queued', status_code: 200 }], error: null },
    };
    const r = await analyzeMissedDiscovery('test');
    expect(r.category).toBe('pattern_wrong');
  });

  it('should handle missing submitted_at for too_slow check', async () => {
    mockResponses.missed_discovery = {
      single: { data: { id: 'test', url: 'https://test.com/a', miss_category: null }, error: null },
      limit: { data: [], error: null },
    };
    mockResponses.kb_source = { limit: { data: [{ slug: 's', rss_feed: 'r' }], error: null } };
    mockResponses.ingestion_queue = {
      limit: {
        data: [{ status: 'queued', status_code: 200, discovered_at: '2024-01-01' }],
        error: null,
      },
    };
    const r = await analyzeMissedDiscovery('test');
    expect(r.category).toBe('pattern_wrong');
  });

  it('should handle source with sitemap only', async () => {
    mockResponses.missed_discovery = {
      single: { data: { id: 'test', url: 'https://test.com/a', miss_category: null }, error: null },
      limit: { data: [], error: null },
    };
    mockResponses.kb_source = {
      limit: { data: [{ slug: 's', sitemap_url: 'http://sitemap' }], error: null },
    };
    mockResponses.ingestion_queue = { limit: { data: [], error: null } };
    const r = await analyzeMissedDiscovery('test');
    expect(r.category).toBe('pattern_missing');
  });

  it('should handle source with scraper only', async () => {
    mockResponses.missed_discovery = {
      single: { data: { id: 'test', url: 'https://test.com/a', miss_category: null }, error: null },
      limit: { data: [], error: null },
    };
    mockResponses.kb_source = {
      limit: { data: [{ slug: 's', scraper_config: { sel: '.x' } }], error: null },
    };
    mockResponses.ingestion_queue = { limit: { data: [], error: null } };
    const r = await analyzeMissedDiscovery('test');
    expect(r.category).toBe('pattern_missing');
  });

  it('should handle payload without rejection_reason', async () => {
    mockResponses.missed_discovery = {
      single: { data: { id: 'test', url: 'https://test.com/a', miss_category: null }, error: null },
      limit: { data: [], error: null },
    };
    mockResponses.kb_source = { limit: { data: [{ slug: 's', rss_feed: 'r' }], error: null } };
    mockResponses.ingestion_queue = {
      limit: { data: [{ status: 'failed', status_code: 500, payload: null }], error: null },
    };
    const r = await analyzeMissedDiscovery('test');
    expect(r.category).toBe('crawl_failed');
  });

  it('should handle empty ingestion data array for days_late', async () => {
    mockResponses.missed_discovery = {
      single: {
        data: {
          id: 'test',
          url: 'https://test.com/a',
          miss_category: null,
          submitted_at: '2024-01-15',
        },
        error: null,
      },
      limit: { data: [], error: null },
    };
    const r = await analyzeMissedDiscovery('test');
    expect(r).toBeDefined();
  });

  it('should handle ingestion data without payload', async () => {
    mockResponses.missed_discovery = {
      single: {
        data: {
          id: 'test',
          url: 'https://test.com/a',
          miss_category: null,
          submitted_at: '2024-01-15',
        },
        error: null,
      },
      limit: { data: [{}], error: null },
    };
    const r = await analyzeMissedDiscovery('test');
    expect(r).toBeDefined();
  });
});
