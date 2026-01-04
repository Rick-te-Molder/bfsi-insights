'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardCard } from './DashboardCard';

interface AgentJob {
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

interface AgentJobCardProps {
  title: string;
  pendingCount: number;
  agentName: string; // 'summarizer', 'tagger', 'thumbnailer'
  color: 'cyan' | 'emerald' | 'violet';
}

const colorClasses = {
  cyan: {
    button: 'bg-cyan-600 hover:bg-cyan-700',
    progress: 'bg-cyan-500',
    pulse: 'bg-cyan-400',
    result: 'text-cyan-400',
  },
  emerald: {
    button: 'bg-emerald-600 hover:bg-emerald-700',
    progress: 'bg-emerald-500',
    pulse: 'bg-emerald-400',
    result: 'text-emerald-400',
  },
  violet: {
    button: 'bg-violet-600 hover:bg-violet-700',
    progress: 'bg-violet-500',
    pulse: 'bg-violet-400',
    result: 'text-violet-400',
  },
};

function getJobStatusClass(status: AgentJob['status']): string {
  if (status === 'completed') return 'text-emerald-400';
  if (status === 'failed') return 'text-red-400';
  return 'text-neutral-400';
}

function formatDuration(start: string, end: string | null): string {
  const startTime = new Date(start).getTime();
  const endTime = end ? new Date(end).getTime() : Date.now();
  const seconds = Math.floor((endTime - startTime) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

type ColorClasses = (typeof colorClasses)[keyof typeof colorClasses];

function ProgressBar({ progress, colorClass }: { progress: number; colorClass: string }) {
  return (
    <div className="w-full bg-neutral-800 rounded-full h-2">
      <div
        className={`${colorClass} h-2 rounded-full transition-all duration-500`}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

function JobStats({ job }: { job: AgentJob }) {
  return (
    <div className="flex justify-between text-xs text-neutral-400">
      <span>
        {job.processed_items} / {job.total_items}
      </span>
      <span>
        {job.success_count} success, {job.failed_count} failed
      </span>
    </div>
  );
}

function RunningJobView({ job, colors }: { job: AgentJob; colors: ColorClasses }) {
  const progressPercent = Math.round((job.processed_items / job.total_items) * 100);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className={`animate-pulse h-2 w-2 rounded-full ${colors.pulse}`} />
        <span className="text-sm text-neutral-300">Processing batch...</span>
      </div>
      <ProgressBar progress={progressPercent} colorClass={colors.progress} />
      <JobStats job={job} />
      {job.current_item_title && (
        <p className="text-xs text-neutral-500 truncate">Current: {job.current_item_title}</p>
      )}
      {job.started_at && (
        <p className="text-xs text-neutral-500">
          Running for {formatDuration(job.started_at, null)}
        </p>
      )}
    </div>
  );
}

function BatchSizeSelect({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm text-white"
    >
      <option value={1}>1 item</option>
      <option value={5}>5 items</option>
      <option value={10}>10 items</option>
      <option value={25}>25 items</option>
      <option value={50}>50 items</option>
    </select>
  );
}

interface IdleJobViewProps {
  batchSize: number;
  setBatchSize: (n: number) => void;
  processing: boolean;
  pendingCount: number;
  colors: ColorClasses;
  error: string | null;
  result: { processed: number; message?: string } | null;
  onRunBatch: () => void;
}

function IdleJobView(props: IdleJobViewProps) {
  const { batchSize, setBatchSize, processing, pendingCount, colors, error, result, onRunBatch } =
    props;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <BatchSizeSelect value={batchSize} onChange={setBatchSize} />
        <button
          onClick={onRunBatch}
          disabled={processing || pendingCount === 0}
          className={`flex-1 px-3 py-1.5 ${colors.button} disabled:bg-neutral-700 disabled:text-neutral-500 text-white text-sm rounded transition-colors`}
        >
          {processing ? 'Running...' : 'Run Batch'}
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {result && (
        <p className={`text-xs ${colors.result}`}>
          {result.message || `Processed ${result.processed} items`}
        </p>
      )}
    </div>
  );
}

function RecentJobsList({ jobs }: { jobs: AgentJob[] }) {
  if (jobs.length === 0) return null;
  return (
    <div className="mt-4 pt-4 border-t border-neutral-800">
      <p className="text-xs text-neutral-500 mb-2">Recent Jobs</p>
      <div className="space-y-2">
        {jobs.map((job) => (
          <div key={job.id} className="flex items-center justify-between text-xs">
            <span className={getJobStatusClass(job.status)}>
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
  );
}

function useAgentJobs(agentName: string) {
  const [jobs, setJobs] = useState<AgentJob[]>([]);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs/${agentName}/jobs`);
      if (!res.ok) return;
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch {
      // Ignore fetch errors
    }
  }, [agentName]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    const hasRunning = jobs.some((j) => j.status === 'running');
    if (!hasRunning) return;
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, [jobs, fetchJobs]);

  return { jobs, fetchJobs };
}

function useRunBatch(agentName: string, batchSize: number, fetchJobs: () => Promise<void>) {
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ processed: number; message?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runBatch = async () => {
    setProcessing(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/jobs/${agentName}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: batchSize }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to run batch');
        return;
      }
      await fetchJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setProcessing(false);
    }
  };

  return { processing, result, error, runBatch };
}

export function AgentJobCard({ title, pendingCount, agentName, color }: AgentJobCardProps) {
  const { jobs, fetchJobs } = useAgentJobs(agentName);
  const [batchSize, setBatchSize] = useState(10);
  const { processing, result, error, runBatch } = useRunBatch(agentName, batchSize, fetchJobs);

  const colors = colorClasses[color];
  const runningJob = jobs.find((j) => j.status === 'running');
  const recentJobs = jobs.filter((j) => j.status !== 'running').slice(0, 3);

  return (
    <DashboardCard title={title} badge={`${pendingCount} pending`} color={color}>
      {runningJob ? (
        <RunningJobView job={runningJob} colors={colors} />
      ) : (
        <IdleJobView
          batchSize={batchSize}
          setBatchSize={setBatchSize}
          processing={processing}
          pendingCount={pendingCount}
          colors={colors}
          error={error}
          result={result}
          onRunBatch={runBatch}
        />
      )}
      <RecentJobsList jobs={recentJobs} />
    </DashboardCard>
  );
}
