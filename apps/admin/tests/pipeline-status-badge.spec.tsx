import { describe, expect, it, vi, afterEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { PipelineStatusBadge } from '@/components/ui/sidebar/PipelineStatusBadge';

describe('PipelineStatusBadge', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders status and tooltip details', () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-01-06T12:00:00.000Z').getTime());

    const html = renderToStaticMarkup(
      <PipelineStatusBadge
        status={{
          status: 'processing',
          lastQueueRun: '2026-01-06T11:59:30.000Z',
          lastBuildTime: null,
          processingCount: 3,
          pendingReviewCount: 0,
          recentFailedCount: 0,
        }}
      />,
    );

    expect(html).toContain('processing');
    expect(html).toContain('Last run');
    expect(html).toContain('Just now');
    expect(html).toContain('Last build');
    expect(html).toContain('Never');
  });

  it('renders degraded state styling and failure count', () => {
    const html = renderToStaticMarkup(
      <PipelineStatusBadge
        status={{
          status: 'degraded',
          lastQueueRun: null,
          lastBuildTime: null,
          processingCount: 0,
          pendingReviewCount: 0,
          recentFailedCount: 2,
        }}
      />,
    );

    expect(html).toContain('degraded');
    expect(html).toContain('text-red-400');
  });
});
