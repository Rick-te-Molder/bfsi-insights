'use client';

import { useState, useEffect, useCallback } from 'react';

interface ThumbnailJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  total_items: number;
  processed_items: number;
  success_count: number;
  failed_count: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  current_item_title: string | null;
}

interface ThumbnailJobsCardProps {
  pendingCount: number;
}

export function ThumbnailJobsCard({ pendingCount }: ThumbnailJobsCardProps) {
  const [jobs, setJobs] = useState<ThumbnailJob[]>([]);
  const [starting, setStarting] = useState(false);
  const [batchSize, setBatchSize] = useState(50);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/thumbnail/jobs');
      if (!res.ok) throw new Error('Failed to fetch jobs');
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    const hasRunning = jobs.some((j) => j.status === 'running');
    if (!hasRunning) return;

    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, [jobs, fetchJobs]);

  const startBatch = async () => {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch('/api/thumbnail/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: batchSize }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to start batch');
        return;
      }
      await fetchJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setStarting(false);
    }
  };

  const runningJob = jobs.find((j) => j.status === 'running');
  const recentJobs = jobs.filter((j) => j.status !== 'running').slice(0, 3);

  const formatDuration = (start: string, end: string | null) => {
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : Date.now();
    const seconds = Math.floor((endTime - startTime) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const progressPercent = runningJob
    ? Math.round((runningJob.processed_items / runningJob.total_items) * 100)
    : 0;

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Thumbnailing</h3>
        <span className="text-sm text-cyan-400">{pendingCount} pending</span>
      </div>

      {runningJob ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="animate-pulse h-2 w-2 rounded-full bg-cyan-400" />
            <span className="text-sm text-neutral-300">Processing batch...</span>
          </div>

          <div className="w-full bg-neutral-800 rounded-full h-2">
            <div
              className="bg-cyan-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex justify-between text-xs text-neutral-400">
            <span>
              {runningJob.processed_items} / {runningJob.total_items}
            </span>
            <span>
              {runningJob.success_count} success, {runningJob.failed_count} failed
            </span>
          </div>

          {runningJob.current_item_title && (
            <p className="text-xs text-neutral-500 truncate">
              Current: {runningJob.current_item_title}
            </p>
          )}

          {runningJob.started_at && (
            <p className="text-xs text-neutral-500">
              Running for {formatDuration(runningJob.started_at, null)}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <select
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value))}
              className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm text-white"
            >
              <option value={10}>10 items</option>
              <option value={25}>25 items</option>
              <option value={50}>50 items</option>
              <option value={100}>100 items</option>
            </select>

            <button
              onClick={startBatch}
              disabled={starting || pendingCount === 0}
              className="flex-1 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 disabled:bg-neutral-700 disabled:text-neutral-500 text-white text-sm rounded transition-colors"
            >
              {starting ? 'Starting...' : 'Start Batch'}
            </button>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      )}

      {recentJobs.length > 0 && (
        <div className="mt-4 pt-4 border-t border-neutral-800">
          <p className="text-xs text-neutral-500 mb-2">Recent Jobs</p>
          <div className="space-y-2">
            {recentJobs.map((job) => (
              <div key={job.id} className="flex items-center justify-between text-xs">
                <span
                  className={
                    job.status === 'completed'
                      ? 'text-emerald-400'
                      : job.status === 'failed'
                        ? 'text-red-400'
                        : 'text-neutral-400'
                  }
                >
                  {job.success_count}/{job.total_items} success
                </span>
                <span className="text-neutral-500">
                  {job.started_at &&
                    job.completed_at &&
                    formatDuration(job.started_at, job.completed_at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
