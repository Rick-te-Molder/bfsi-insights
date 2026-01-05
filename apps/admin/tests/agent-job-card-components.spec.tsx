import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  formatDuration,
  getJobStatusClass,
  ProgressBar,
  RecentJobsList,
  type AgentJob,
} from '@/components/dashboard/AgentJobCardComponents';

describe('AgentJobCardComponents', () => {
  it('getJobStatusClass returns expected classes', () => {
    expect(getJobStatusClass('completed')).toContain('emerald');
    expect(getJobStatusClass('failed')).toContain('red');
    expect(getJobStatusClass('running')).toContain('neutral');
  });

  it('formatDuration formats seconds and minutes', () => {
    const start = new Date(Date.now() - 42_000).toISOString();
    expect(formatDuration(start, null)).toMatch(/\ds/);

    const start2 = new Date(Date.now() - 65_000).toISOString();
    expect(formatDuration(start2, null)).toMatch(/1m/);
  });

  it('ProgressBar renders width percentage', () => {
    const html = renderToStaticMarkup(<ProgressBar progress={33} colorClass="bg-cyan-500" />);
    expect(html).toContain('width:33%');
  });

  it('RecentJobsList renders nothing for empty list', () => {
    const html = renderToStaticMarkup(<RecentJobsList jobs={[]} />);
    expect(html).toBe('');
  });

  it('RecentJobsList renders job entries', () => {
    const job: AgentJob = {
      id: '1',
      status: 'completed',
      total_items: 10,
      processed_items: 10,
      success_count: 10,
      failed_count: 0,
      started_at: new Date(Date.now() - 10_000).toISOString(),
      completed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      current_item_title: null,
    };

    const html = renderToStaticMarkup(<RecentJobsList jobs={[job]} />);
    expect(html).toContain('success');
  });
});
