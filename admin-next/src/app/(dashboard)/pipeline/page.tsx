import { createServiceRoleClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { PipelineMetrics } from './pipeline-metrics';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface StepStats {
  step_name: string;
  avg_duration_ms: number;
  success_count: number;
  failed_count: number;
}

async function getPipelineHealth() {
  const supabase = createServiceRoleClient();

  // Avg time per step (last 24h)
  const { data: stepStats } = await supabase.rpc('get_step_stats_24h');

  return {
    stepStats: (stepStats || []) as StepStats[],
  };
}

export default async function PipelinePage() {
  const health = await getPipelineHealth();

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pipeline Health</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Real-time metrics and bottleneck detection
          </p>
        </div>
        <Link
          href="/review"
          className="rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-300 hover:bg-neutral-700 transition-colors"
        >
          ← Back to Review
        </Link>
      </header>

      <PipelineMetrics initialHealth={health} />
    </div>
  );
}
