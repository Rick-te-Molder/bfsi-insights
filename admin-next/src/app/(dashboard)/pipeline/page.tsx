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

  // Load status codes
  const { data: statusData } = await supabase
    .from('status_lookup')
    .select('code, name')
    .order('code');

  const statusCodes: Record<string, number> = {};
  for (const row of statusData || []) {
    statusCodes[row.name] = row.code;
  }

  // WIP counts per stage
  const stages = [
    { name: 'summarizer', workingCode: statusCodes['summarizing'] },
    { name: 'tagger', workingCode: statusCodes['tagging'] },
    { name: 'thumbnailer', workingCode: statusCodes['thumbnailing'] },
  ];

  const wipCounts: Record<string, number> = {};
  for (const stage of stages) {
    if (stage.workingCode) {
      const { count } = await supabase
        .from('ingestion_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status_code', stage.workingCode);
      wipCounts[stage.name] = count || 0;
    }
  }

  // Dead letter count
  const { count: dlqCount } = await supabase
    .from('ingestion_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status_code', 599);

  // Stuck items (in working status > 1 hour)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const workingCodes = stages.map((s) => s.workingCode).filter(Boolean);

  const { data: stuckItems } = await supabase
    .from('ingestion_queue')
    .select('id, url, status_code, payload, discovered_at')
    .in('status_code', workingCodes)
    .lt('discovered_at', oneHourAgo)
    .limit(10);

  // Throughput: completed in last 24h
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: completedLast24h } = await supabase
    .from('pipeline_step_run')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'success')
    .gte('completed_at', twentyFourHoursAgo);

  // Avg time per step (last 24h)
  const { data: stepStats } = await supabase.rpc('get_step_stats_24h');

  // Queue counts per status
  const queueCounts: Record<string, number> = {};
  const importantStatuses = [
    'pending_enrichment',
    'to_summarize',
    'to_tag',
    'to_thumbnail',
    'pending_review',
    'approved',
    'failed',
    'dead_letter',
  ];

  for (const status of importantStatuses) {
    const code = statusCodes[status];
    if (code) {
      const { count } = await supabase
        .from('ingestion_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status_code', code);
      queueCounts[status] = count || 0;
    }
  }

  return {
    wipCounts,
    dlqCount: dlqCount || 0,
    stuckItems: stuckItems || [],
    completedLast24h: completedLast24h || 0,
    stepStats: (stepStats || []) as StepStats[],
    queueCounts,
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
