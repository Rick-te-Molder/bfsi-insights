import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  colorClasses,
  getJobStatusClass,
  formatDuration,
  ProgressBar,
  JobStats,
  RunningJobView,
  BatchSizeSelect,
  IdleJobView,
  RecentJobsList,
  type AgentJob,
} from '@/components/dashboard/AgentJobCardComponents';

describe('AgentJobCardComponents', () => {
  describe('colorClasses', () => {
    it('has cyan color classes', () => {
      expect(colorClasses.cyan.button).toContain('cyan');
      expect(colorClasses.cyan.progress).toContain('cyan');
    });

    it('has emerald color classes', () => {
      expect(colorClasses.emerald.button).toContain('emerald');
    });

    it('has violet color classes', () => {
      expect(colorClasses.violet.button).toContain('violet');
    });
  });

  describe('getJobStatusClass', () => {
    it('returns emerald for completed', () => {
      expect(getJobStatusClass('completed')).toBe('text-emerald-400');
    });

    it('returns red for failed', () => {
      expect(getJobStatusClass('failed')).toBe('text-red-400');
    });

    it('returns neutral for other statuses', () => {
      expect(getJobStatusClass('pending')).toBe('text-neutral-400');
      expect(getJobStatusClass('running')).toBe('text-neutral-400');
      expect(getJobStatusClass('cancelled')).toBe('text-neutral-400');
    });
  });

  describe('formatDuration', () => {
    it('formats seconds', () => {
      const start = new Date('2024-01-01T00:00:00Z').toISOString();
      const end = new Date('2024-01-01T00:00:30Z').toISOString();
      expect(formatDuration(start, end)).toBe('30s');
    });

    it('formats minutes and seconds', () => {
      const start = new Date('2024-01-01T00:00:00Z').toISOString();
      const end = new Date('2024-01-01T00:02:30Z').toISOString();
      expect(formatDuration(start, end)).toBe('2m 30s');
    });

    it('uses current time when end is null', () => {
      const start = new Date(Date.now() - 5000).toISOString();
      const result = formatDuration(start, null);
      expect(result).toMatch(/^\d+s$/);
    });
  });

  describe('ProgressBar', () => {
    it('renders with correct width style', () => {
      const html = renderToStaticMarkup(<ProgressBar progress={50} colorClass="bg-cyan-500" />);
      expect(html).toContain('width:50%');
    });
  });

  describe('JobStats', () => {
    it('renders job statistics', () => {
      const job: AgentJob = {
        id: '1',
        status: 'running',
        total_items: 100,
        processed_items: 50,
        success_count: 45,
        failed_count: 5,
        started_at: null,
        completed_at: null,
        created_at: '2024-01-01',
        current_item_title: null,
      };

      const html = renderToStaticMarkup(<JobStats job={job} />);

      expect(html).toContain('50 / 100');
      expect(html).toContain('45 success, 5 failed');
    });
  });

  describe('RunningJobView', () => {
    it('renders running job with progress', () => {
      const job: AgentJob = {
        id: '1',
        status: 'running',
        total_items: 100,
        processed_items: 50,
        success_count: 45,
        failed_count: 5,
        started_at: new Date().toISOString(),
        completed_at: null,
        created_at: '2024-01-01',
        current_item_title: 'Test Item',
      };

      const html = renderToStaticMarkup(<RunningJobView job={job} colors={colorClasses.cyan} />);

      expect(html).toContain('Processing batch...');
      expect(html).toContain('Current: Test Item');
    });

    it('shows running time when started_at is set', () => {
      const job: AgentJob = {
        id: '1',
        status: 'running',
        total_items: 100,
        processed_items: 50,
        success_count: 45,
        failed_count: 5,
        started_at: new Date(Date.now() - 60000).toISOString(),
        completed_at: null,
        created_at: '2024-01-01',
        current_item_title: null,
      };

      const html = renderToStaticMarkup(<RunningJobView job={job} colors={colorClasses.cyan} />);

      expect(html).toContain('Running for');
    });
  });

  describe('BatchSizeSelect', () => {
    it('renders with options', () => {
      const html = renderToStaticMarkup(<BatchSizeSelect value={10} onChange={() => {}} />);
      expect(html).toContain('10 items');
      expect(html).toContain('25 items');
    });
  });

  describe('IdleJobView', () => {
    it('renders batch controls', () => {
      const html = renderToStaticMarkup(
        <IdleJobView
          batchSize={10}
          setBatchSize={() => {}}
          processing={false}
          pendingCount={5}
          colors={colorClasses.cyan}
          error={null}
          result={null}
          onRunBatch={() => {}}
        />,
      );

      expect(html).toContain('Run Batch');
    });

    it('shows error message', () => {
      const html = renderToStaticMarkup(
        <IdleJobView
          batchSize={10}
          setBatchSize={() => {}}
          processing={false}
          pendingCount={5}
          colors={colorClasses.cyan}
          error="Something went wrong"
          result={null}
          onRunBatch={() => {}}
        />,
      );

      expect(html).toContain('Something went wrong');
    });

    it('shows result message', () => {
      const html = renderToStaticMarkup(
        <IdleJobView
          batchSize={10}
          setBatchSize={() => {}}
          processing={false}
          pendingCount={5}
          colors={colorClasses.cyan}
          error={null}
          result={{ processed: 10, message: 'Done!' }}
          onRunBatch={() => {}}
        />,
      );

      expect(html).toContain('Done!');
    });

    it('shows default result message when no message provided', () => {
      const html = renderToStaticMarkup(
        <IdleJobView
          batchSize={10}
          setBatchSize={() => {}}
          processing={false}
          pendingCount={5}
          colors={colorClasses.cyan}
          error={null}
          result={{ processed: 10 }}
          onRunBatch={() => {}}
        />,
      );

      expect(html).toContain('Processed 10 items');
    });

    it('shows Running text when processing', () => {
      const html = renderToStaticMarkup(
        <IdleJobView
          batchSize={10}
          setBatchSize={() => {}}
          processing={true}
          pendingCount={5}
          colors={colorClasses.cyan}
          error={null}
          result={null}
          onRunBatch={() => {}}
        />,
      );

      expect(html).toContain('Running...');
    });
  });

  describe('RecentJobsList', () => {
    it('returns null for empty jobs', () => {
      const html = renderToStaticMarkup(<RecentJobsList jobs={[]} />);
      expect(html).toBe('');
    });

    it('renders job list', () => {
      const jobs: AgentJob[] = [
        {
          id: '1',
          status: 'completed',
          total_items: 10,
          processed_items: 10,
          success_count: 8,
          failed_count: 2,
          started_at: '2024-01-01T00:00:00Z',
          completed_at: '2024-01-01T00:01:00Z',
          created_at: '2024-01-01',
          current_item_title: null,
        },
      ];

      const html = renderToStaticMarkup(<RecentJobsList jobs={jobs} />);

      expect(html).toContain('Recent Jobs');
      expect(html).toContain('8/10 success');
    });
  });
});
