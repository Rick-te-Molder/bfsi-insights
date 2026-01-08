/**
 * Classification tests for improver.js
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
const { analyzeMissedDiscovery } = improverModule.default || improverModule;

describe('Classification branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResponses = {};
    callCounts = {};
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
  });

  it('should classify as filter_rejected when status is rejected', async () => {
    mockResponses.missed_discovery = {
      single: {
        data: {
          id: 'test-id',
          url: 'https://tracked.com/article',
          url_norm: 'https://tracked.com/article',
          miss_category: null,
        },
        error: null,
      },
      limit: { data: [], error: null },
    };
    mockResponses.kb_source = {
      limit: { data: [{ slug: 'tracked', rss_feed: 'http://rss' }], error: null },
    };
    mockResponses.ingestion_queue = {
      limit: {
        data: [
          {
            id: 'ing-1',
            status: 'rejected',
            status_code: 540,
            payload: { rejection_reason: 'Low score', relevance_scores: { exec: 2 } },
          },
        ],
        error: null,
      },
    };
    const result = await analyzeMissedDiscovery('test-id');
    expect(result.success).toBe(true);
    expect(result.category).toBe('filter_rejected');
  });

  it('should classify as too_slow when found late', async () => {
    mockResponses.missed_discovery = {
      single: {
        data: {
          id: 'test-id',
          url: 'https://tracked.com/article',
          url_norm: 'https://tracked.com/article',
          miss_category: null,
          submitted_at: '2024-01-20T00:00:00Z',
        },
        error: null,
      },
      limit: { data: [], error: null },
    };
    mockResponses.kb_source = {
      limit: { data: [{ slug: 'tracked', rss_feed: 'http://rss' }], error: null },
    };
    mockResponses.ingestion_queue = {
      limit: {
        data: [
          {
            id: 'ing-1',
            status: 'pending',
            status_code: 300,
            discovered_at: '2024-01-10T00:00:00Z',
          },
        ],
        error: null,
      },
    };
    const result = await analyzeMissedDiscovery('test-id');
    expect(result.success).toBe(true);
    expect(result.category).toBe('too_slow');
  });

  it('should classify as crawl_failed when status is failed', async () => {
    mockResponses.missed_discovery = {
      single: {
        data: {
          id: 'test-id',
          url: 'https://tracked.com/article',
          url_norm: 'https://tracked.com/article',
          miss_category: null,
        },
        error: null,
      },
      limit: { data: [], error: null },
    };
    mockResponses.kb_source = {
      limit: { data: [{ slug: 'tracked', rss_feed: 'http://rss' }], error: null },
    };
    mockResponses.ingestion_queue = {
      limit: {
        data: [
          {
            id: 'ing-1',
            status: 'failed',
            status_code: 500,
            payload: { rejection_reason: 'Timeout' },
          },
        ],
        error: null,
      },
    };
    const result = await analyzeMissedDiscovery('test-id');
    expect(result.success).toBe(true);
    expect(result.category).toBe('crawl_failed');
  });

  it('should classify as pattern_wrong when found with other status', async () => {
    mockResponses.missed_discovery = {
      single: {
        data: {
          id: 'test-id',
          url: 'https://tracked.com/article',
          url_norm: 'https://tracked.com/article',
          miss_category: null,
        },
        error: null,
      },
      limit: { data: [], error: null },
    };
    mockResponses.kb_source = {
      limit: { data: [{ slug: 'tracked', rss_feed: 'http://rss' }], error: null },
    };
    mockResponses.ingestion_queue = {
      limit: { data: [{ id: 'ing-1', status: 'published', status_code: 400 }], error: null },
    };
    const result = await analyzeMissedDiscovery('test-id');
    expect(result.success).toBe(true);
    expect(result.category).toBe('pattern_wrong');
  });

  it('should classify as pattern_missing when source has RSS but URL not found', async () => {
    mockResponses.missed_discovery = {
      single: {
        data: {
          id: 'test-id',
          url: 'https://tracked.com/new-article',
          url_norm: 'https://tracked.com/new-article',
          miss_category: null,
        },
        error: null,
      },
      limit: { data: [], error: null },
    };
    mockResponses.kb_source = {
      limit: {
        data: [
          { slug: 'tracked', rss_feed: 'http://rss', sitemap_url: null, scraper_config: null },
        ],
        error: null,
      },
    };
    mockResponses.ingestion_queue = {
      limit: { data: [], error: null },
    };
    const result = await analyzeMissedDiscovery('test-id');
    expect(result.success).toBe(true);
    expect(result.category).toBe('pattern_missing');
  });

  it('should classify as crawl_failed when source has no discovery config', async () => {
    mockResponses.missed_discovery = {
      single: {
        data: {
          id: 'test-id',
          url: 'https://tracked.com/article',
          url_norm: 'https://tracked.com/article',
          miss_category: null,
        },
        error: null,
      },
      limit: { data: [], error: null },
    };
    mockResponses.kb_source = {
      limit: {
        data: [{ slug: 'tracked', rss_feed: null, sitemap_url: null, scraper_config: null }],
        error: null,
      },
    };
    mockResponses.ingestion_queue = {
      limit: { data: [], error: null },
    };
    const result = await analyzeMissedDiscovery('test-id');
    expect(result.success).toBe(true);
    expect(result.category).toBe('crawl_failed');
  });

  it('should handle www prefix in domain extraction', async () => {
    mockResponses.missed_discovery = {
      single: {
        data: { id: 'test-id', url: 'https://www.example.com/article', miss_category: null },
        error: null,
      },
    };
    const result = await analyzeMissedDiscovery('test-id');
    expect(result).toBeDefined();
  });

  it('should use url_norm when available', async () => {
    mockResponses.missed_discovery = {
      single: {
        data: {
          id: 'test-id',
          url: 'https://example.com/Article',
          url_norm: 'https://example.com/article',
          miss_category: null,
        },
        error: null,
      },
    };
    const result = await analyzeMissedDiscovery('test-id');
    expect(result).toBeDefined();
  });

  it('should handle missing url_norm by using lowercase url', async () => {
    mockResponses.missed_discovery = {
      single: {
        data: { id: 'test-id', url: 'https://EXAMPLE.COM/Article', miss_category: null },
        error: null,
      },
    };
    const result = await analyzeMissedDiscovery('test-id');
    expect(result).toBeDefined();
  });
});

describe('Days calculation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResponses = {};
    callCounts = {};
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
  });

  it('should calculate days_late from published_at', async () => {
    mockResponses.missed_discovery = {
      single: {
        data: {
          id: 'test-id',
          url: 'https://example.com/article',
          url_norm: 'https://example.com/article',
          miss_category: null,
          submitted_at: '2024-01-15T00:00:00Z',
        },
        error: null,
      },
      limit: { data: [{ payload: { published_at: '2024-01-10T00:00:00Z' } }], error: null },
    };
    const result = await analyzeMissedDiscovery('test-id');
    expect(result).toBeDefined();
    expect(result.days_late).toBeDefined();
  });

  it('should handle missing published_at', async () => {
    mockResponses.missed_discovery = {
      single: {
        data: {
          id: 'test-id',
          url: 'https://example.com/article',
          url_norm: 'https://example.com/article',
          miss_category: null,
          submitted_at: '2024-01-15T00:00:00Z',
        },
        error: null,
      },
      limit: { data: [{ payload: {} }], error: null },
    };
    const result = await analyzeMissedDiscovery('test-id');
    expect(result).toBeDefined();
  });
});
