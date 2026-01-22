'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BarChart3, RefreshCw } from 'lucide-react';
import {
  SummaryCards,
  StatusDistribution,
  StepFailureTable,
  StuckItemsTable,
  type StatusSummary,
  type StepFailureRate,
  type StuckItem,
} from './components';

function LoadingSkeleton() {
  return (
    <div className="p-6">
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/4"></div>
        <div className="h-32 bg-gray-200 rounded"></div>
        <div className="h-64 bg-gray-200 rounded"></div>
      </div>
    </div>
  );
}

function ErrorBanner({ message }: Readonly<{ message: string }>) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
      {message}
    </div>
  );
}

async function fetchStatusSummary(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase.from('workflow_status_summary').select('*');
  if (error) {
    const msg = typeof error.message === 'string' ? error.message : 'Unknown error';
    throw new Error(`Status summary: ${msg}`);
  }
  return (data as StatusSummary[]) || [];
}

async function fetchStepFailures(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase.from('step_failure_rates').select('*');
  if (error) {
    const msg = typeof error.message === 'string' ? error.message : 'Unknown error';
    throw new Error(`Step failures: ${msg}`);
  }
  return (data as StepFailureRate[]) || [];
}

async function fetchStuckItems(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase.from('stuck_items').select('*').limit(10);
  if (error) {
    const msg = typeof error.message === 'string' ? error.message : 'Unknown error';
    throw new Error(`Stuck items: ${msg}`);
  }
  return (data as StuckItem[]) || [];
}

function DashboardHeader({ onRefresh }: Readonly<{ onRefresh: () => void }>) {
  return (
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <BarChart3 className="h-6 w-6" />
        Workflow Dashboard
      </h1>
      <button
        onClick={onRefresh}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        <RefreshCw className="h-4 w-4" />
        Refresh
      </button>
    </div>
  );
}

function computeTotals(statusSummary: StatusSummary[]) {
  return {
    totalItems: statusSummary.reduce((sum, s) => sum + (s.item_count || 0), 0),
    totalFailed: statusSummary.reduce((sum, s) => sum + (s.failed_count || 0), 0),
    totalPendingRetry: statusSummary.reduce((sum, s) => sum + (s.pending_retry_count || 0), 0),
  };
}

async function fetchAllWorkflowData() {
  const supabase = createClient();
  const [statusSummary, stepFailures, stuckItems] = await Promise.all([
    fetchStatusSummary(supabase),
    fetchStepFailures(supabase),
    fetchStuckItems(supabase),
  ]);
  return { statusSummary, stepFailures, stuckItems };
}

function useWorkflowData() {
  const [statusSummary, setStatusSummary] = useState<StatusSummary[]>([]);
  const [stepFailures, setStepFailures] = useState<StepFailureRate[]>([]);
  const [stuckItems, setStuckItems] = useState<StuckItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllWorkflowData();
      setStatusSummary(data.statusSummary);
      setStepFailures(data.stepFailures);
      setStuckItems(data.stuckItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { statusSummary, stepFailures, stuckItems, loading, error, fetchData };
}

export default function WorkflowDashboardPage() {
  const { statusSummary, stepFailures, stuckItems, loading, error, fetchData } = useWorkflowData();

  if (loading) return <LoadingSkeleton />;

  const { totalItems, totalFailed, totalPendingRetry } = computeTotals(statusSummary);

  return (
    <div className="p-6 space-y-6">
      <DashboardHeader onRefresh={fetchData} />
      {error && <ErrorBanner message={error} />}
      <SummaryCards
        totalItems={totalItems}
        totalFailed={totalFailed}
        totalPendingRetry={totalPendingRetry}
        stuckCount={stuckItems.length}
      />
      <StatusDistribution statusSummary={statusSummary} totalItems={totalItems} />
      <StepFailureTable stepFailures={stepFailures} />
      <StuckItemsTable stuckItems={stuckItems} />
    </div>
  );
}
