'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardCard } from './DashboardCard';
import {
  AgentJob,
  colorClasses,
  ColorClasses,
  RunningJobView,
  IdleJobView,
  RecentJobsList,
} from './AgentJobCardComponents';

interface AgentJobCardProps {
  title: string;
  pendingCount: number;
  agentName: string;
  color: 'cyan' | 'emerald' | 'violet';
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

function useAgentJobCardState(agentName: string, color: AgentJobCardProps['color']) {
  const { jobs, fetchJobs } = useAgentJobs(agentName);
  const [batchSize, setBatchSize] = useState(10);
  const { processing, result, error, runBatch } = useRunBatch(agentName, batchSize, fetchJobs);
  const colors = colorClasses[color];
  const runningJob = jobs.find((j) => j.status === 'running');
  const recentJobs = jobs.filter((j) => j.status !== 'running').slice(0, 3);
  return {
    batchSize,
    setBatchSize,
    processing,
    result,
    error,
    runBatch,
    colors,
    runningJob,
    recentJobs,
  };
}

interface JobContentProps {
  runningJob: AgentJob | undefined;
  colors: ColorClasses;
  batchSize: number;
  setBatchSize: (n: number) => void;
  processing: boolean;
  pendingCount: number;
  error: string | null;
  result: { processed: number; message?: string } | null;
  runBatch: () => void;
}

function JobContent({
  runningJob,
  colors,
  batchSize,
  setBatchSize,
  processing,
  pendingCount,
  error,
  result,
  runBatch,
}: Readonly<JobContentProps>) {
  if (runningJob) return <RunningJobView job={runningJob} colors={colors} />;
  return (
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
  );
}

export function AgentJobCard({
  title,
  pendingCount,
  agentName,
  color,
}: Readonly<AgentJobCardProps>) {
  const state = useAgentJobCardState(agentName, color);
  return (
    <DashboardCard title={title} badge={`${pendingCount} pending`} color={color}>
      <JobContent {...state} pendingCount={pendingCount} />
      <RecentJobsList jobs={state.recentJobs} />
    </DashboardCard>
  );
}
