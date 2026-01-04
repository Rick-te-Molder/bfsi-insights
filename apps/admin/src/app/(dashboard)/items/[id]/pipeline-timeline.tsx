'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface StepRun {
  id: string;
  run_id: string;
  step_name: string;
  status: string;
  attempt: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
}

interface PipelineRun {
  id: string;
  trigger: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  created_by: string | null;
  steps: StepRun[];
}

interface PipelineTimelineProps {
  queueId: string;
  currentRunId?: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  running: 'bg-blue-500',
  success: 'bg-emerald-500',
  failed: 'bg-red-500',
  cancelled: 'bg-neutral-500',
  skipped: 'bg-amber-500',
  pending: 'bg-neutral-600',
};

const STATUS_ICONS: Record<string, string> = {
  running: '⏳',
  success: '✅',
  failed: '❌',
  cancelled: '🚫',
  skipped: '⏭️',
  pending: '⏸️',
};

const TRIGGER_LABELS: Record<string, string> = {
  discovery: '🔍 Discovery',
  manual: '✋ Manual',
  're-enrich': '🔄 Re-enrich',
  retry: '🔁 Retry',
};

function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt) return '-';
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const ms = end - start;

  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60000)}m`;
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('en-GB', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function fetchPipelineRuns(queueId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('pipeline_run')
    .select('id, trigger, status, started_at, completed_at, created_by')
    .eq('queue_id', queueId)
    .order('started_at', { ascending: false });
  if (error) console.error('Error fetching pipeline runs:', error);
  return data;
}

async function fetchStepRuns(runIds: string[]) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('pipeline_step_run')
    .select('id, run_id, step_name, status, attempt, started_at, completed_at, error_message')
    .in('run_id', runIds)
    .order('started_at', { ascending: true });
  if (error) console.error('Error fetching step runs:', error);
  return data;
}

function groupStepsByRun(stepsData: StepRun[] | null): Map<string, StepRun[]> {
  const stepsByRun = new Map<string, StepRun[]>();
  for (const step of stepsData || []) {
    const runSteps = stepsByRun.get(step.run_id) || [];
    runSteps.push(step);
    stepsByRun.set(step.run_id, runSteps);
  }
  return stepsByRun;
}

function usePipelineData(queueId: string, currentRunId?: string | null) {
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(currentRunId || null);

  useEffect(() => {
    (async () => {
      const runsData = await fetchPipelineRuns(queueId);
      if (!runsData) {
        setLoading(false);
        return;
      }
      const stepsData = await fetchStepRuns(runsData.map((r) => r.id));
      const stepsByRun = groupStepsByRun(stepsData);
      const runsWithSteps = runsData.map((run) => ({
        ...run,
        steps: stepsByRun.get(run.id) || [],
      }));
      setRuns(runsWithSteps);
      setLoading(false);
      setExpanded(currentRunId || runsWithSteps[0]?.id || null);
    })();
  }, [queueId, currentRunId]);

  return { runs, loading, expanded, setExpanded };
}

function TimelineHeader() {
  return (
    <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-3">
      Pipeline History
    </h3>
  );
}

function LoadingState() {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <TimelineHeader />
      <div className="animate-pulse space-y-2">
        <div className="h-8 bg-neutral-800 rounded" />
        <div className="h-8 bg-neutral-800 rounded" />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <TimelineHeader />
      <p className="text-sm text-neutral-500">No pipeline runs yet (legacy item)</p>
    </div>
  );
}

function RunHeader({
  run,
  isCurrent,
  isExpanded,
  onToggle,
}: Readonly<{ run: PipelineRun; isCurrent: boolean; isExpanded: boolean; onToggle: () => void }>) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between p-3 text-left hover:bg-neutral-800/50 transition-colors rounded-lg"
    >
      <div className="flex items-center gap-3">
        <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[run.status]}`} />
        <span className="text-sm font-medium text-neutral-200">
          {TRIGGER_LABELS[run.trigger] || run.trigger}
        </span>
        {isCurrent && (
          <span className="text-xs bg-sky-500/20 text-sky-300 px-1.5 py-0.5 rounded">current</span>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs text-neutral-500">
        <span>{formatTime(run.started_at)}</span>
        <span>{formatDuration(run.started_at, run.completed_at)}</span>
        <span>{isExpanded ? '▼' : '▶'}</span>
      </div>
    </button>
  );
}

function StepItem({ step }: Readonly<{ step: StepRun }>) {
  return (
    <div className="flex items-start gap-3 text-sm pl-2 border-l-2 border-neutral-700">
      <span className="text-base leading-none mt-0.5">{STATUS_ICONS[step.status]}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="font-medium text-neutral-300 capitalize">
            {step.step_name}
            {step.attempt > 1 && (
              <span className="text-xs text-neutral-500 ml-1">(attempt {step.attempt})</span>
            )}
          </span>
          <span className="text-xs text-neutral-500">
            {formatDuration(step.started_at, step.completed_at)}
          </span>
        </div>
        {step.error_message && (
          <p className="text-xs text-red-400 mt-1 truncate" title={step.error_message}>
            {step.error_message.slice(0, 100)}
            {step.error_message.length > 100 && '...'}
          </p>
        )}
      </div>
    </div>
  );
}

function StepsList({ steps }: Readonly<{ steps: StepRun[] }>) {
  if (steps.length === 0)
    return (
      <div className="border-t border-neutral-800 p-3">
        <p className="text-xs text-neutral-500">No step data recorded</p>
      </div>
    );
  return (
    <div className="border-t border-neutral-800 p-3 space-y-2">
      {steps.map((step) => (
        <StepItem key={step.id} step={step} />
      ))}
    </div>
  );
}

function RunCard({
  run,
  isCurrent,
  isExpanded,
  onToggle,
}: Readonly<{ run: PipelineRun; isCurrent: boolean; isExpanded: boolean; onToggle: () => void }>) {
  return (
    <div
      className={`rounded-lg border ${isCurrent ? 'border-sky-500/50 bg-sky-500/5' : 'border-neutral-800 bg-neutral-800/30'}`}
    >
      <RunHeader run={run} isCurrent={isCurrent} isExpanded={isExpanded} onToggle={onToggle} />
      {isExpanded && <StepsList steps={run.steps} />}
    </div>
  );
}

export function PipelineTimeline({ queueId, currentRunId }: Readonly<PipelineTimelineProps>) {
  const { runs, loading, expanded, setExpanded } = usePipelineData(queueId, currentRunId);
  if (loading) return <LoadingState />;
  if (runs.length === 0) return <EmptyState />;
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <TimelineHeader />
      <div className="space-y-2">
        {runs.map((run) => (
          <RunCard
            key={run.id}
            run={run}
            isCurrent={run.id === currentRunId}
            isExpanded={expanded === run.id}
            onToggle={() => setExpanded(expanded === run.id ? null : run.id)}
          />
        ))}
      </div>
    </div>
  );
}
