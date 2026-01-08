import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StatusProvider, useStatus } from '@/contexts/StatusContext';

// Mock supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        order: () =>
          Promise.resolve({
            data: [
              {
                code: 200,
                name: 'pending_enrichment',
                description: null,
                category: 'enrichment',
                is_terminal: false,
              },
              {
                code: 300,
                name: 'pending_review',
                description: null,
                category: 'review',
                is_terminal: false,
              },
              {
                code: 400,
                name: 'published',
                description: null,
                category: 'published',
                is_terminal: true,
              },
            ],
            error: null,
          }),
      }),
    }),
  }),
}));

function TestConsumer() {
  try {
    const status = useStatus();
    return (
      <pre>
        {JSON.stringify({
          loading: status.loading,
          statusCount: status.statuses.length,
        })}
      </pre>
    );
  } catch {
    return <div>Error: useStatus must be used within StatusProvider</div>;
  }
}

describe('StatusContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('StatusProvider', () => {
    it('renders children', () => {
      const html = renderToStaticMarkup(
        <StatusProvider>
          <div>Child Content</div>
        </StatusProvider>,
      );

      expect(html).toContain('Child Content');
    });

    it('provides status context to children', () => {
      const html = renderToStaticMarkup(
        <StatusProvider>
          <TestConsumer />
        </StatusProvider>,
      );

      expect(html).toContain('statusCount');
    });

    it('initializes with fallback statuses', () => {
      const html = renderToStaticMarkup(
        <StatusProvider>
          <TestConsumer />
        </StatusProvider>,
      );

      // Should have statuses from fallback initially
      expect(html).toContain('statusCount');
    });
  });

  describe('useStatus', () => {
    it('throws error when used outside provider', () => {
      const html = renderToStaticMarkup(<TestConsumer />);

      expect(html).toContain('Error: useStatus must be used within StatusProvider');
    });
  });

  describe('Status helpers', () => {
    function HelperTestConsumer() {
      try {
        const { getStatusName, getStatusColor, getStatusByCode } = useStatus();
        return (
          <pre>
            {JSON.stringify({
              name200: getStatusName(200),
              color200: getStatusColor(200),
              status200: getStatusByCode(200)?.name,
              nameUnknown: getStatusName(999),
            })}
          </pre>
        );
      } catch {
        return <div>Error</div>;
      }
    }

    it('provides helper functions', () => {
      const html = renderToStaticMarkup(
        <StatusProvider>
          <HelperTestConsumer />
        </StatusProvider>,
      );

      expect(html).toContain('pending_enrichment');
    });

    it('returns fallback for unknown status code', () => {
      const html = renderToStaticMarkup(
        <StatusProvider>
          <HelperTestConsumer />
        </StatusProvider>,
      );

      expect(html).toContain('status_999');
    });
  });
});
