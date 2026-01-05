import Link from 'next/link';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { LivePipelineStatus } from '@/components/dashboard/LivePipelineStatus';
import { AgentJobCard } from '@/components/dashboard/AgentJobCard';
import { DiscoveryControlCard } from '@/components/dashboard/DiscoveryControlCard';

// Force dynamic rendering to always get fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Status code ranges (see docs/architecture/pipeline-status-codes.md)
const STATUS = {
  // Enrichment (200s)
  PENDING_ENRICHMENT: 200,
  TO_SUMMARIZE: 210,
  SUMMARIZING: 211,
  TO_TAG: 220,
  TO_THUMBNAIL: 230,
  ENRICHED: 240,
  // Review (300s)
  PENDING_REVIEW: 300,
  APPROVED: 330,
  // Published (400s)
  PUBLISHED: 400,
  // Terminal (500s)
  FAILED: 500,
  REJECTED: 540,
};

type SupabaseClient = ReturnType<typeof createServiceRoleClient>;

/** Fetch status counts via RPC (single query replaces 6+ individual counts) */
function fetchStatusCounts(supabase: SupabaseClient) {
  return supabase.rpc('get_status_code_counts');
}

/** Fetch recent failures for alert section */
function fetchRecentFailures(supabase: SupabaseClient) {
  return supabase
    .from('ingestion_queue')
    .select('id, url, payload, updated_at')
    .eq('status_code', STATUS.FAILED)
    .order('updated_at', { ascending: false })
    .limit(5);
}

/** Fetch failed count in last 24h for alerts */
function fetchFailedLast24h(supabase: SupabaseClient, since: string) {
  return supabase
    .from('ingestion_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status_code', STATUS.FAILED)
    .gte('updated_at', since);
}

/** Fetch pending entity proposals count */
function fetchPendingProposals(supabase: SupabaseClient) {
  return supabase
    .from('proposed_entity')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');
}

async function getStats() {
  const supabase = createServiceRoleClient();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Run all queries in parallel for performance
  const [statusRes, failuresRes, failed24hRes, proposalsRes] = await Promise.all([
    fetchStatusCounts(supabase),
    fetchRecentFailures(supabase),
    fetchFailedLast24h(supabase, oneDayAgo),
    fetchPendingProposals(supabase),
  ]);

  return {
    allStatusData: statusRes.data,
    recentFailures: failuresRes.data || [],
    failedLast24h: failed24hRes.count || 0,
    pendingProposals: proposalsRes.count || 0,
  };
}

export default async function DashboardPage() {
  const { recentFailures, pendingProposals, failedLast24h, allStatusData } = await getStats();

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <header>
        <h1 className="text-xl md:text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-sm text-neutral-400">Overview of the ingestion pipeline</p>
      </header>

      {/* Detailed Pipeline Status */}
      <div className="space-y-3">
        <h2 className="text-xs md:text-sm font-medium text-neutral-400 uppercase tracking-wide">
          Pipeline Status by Code
        </h2>
        <LivePipelineStatus initialData={allStatusData} pollInterval={5000} />
      </div>

      {/* Agent Controls */}
      <div className="space-y-3">
        <h2 className="text-xs md:text-sm font-medium text-neutral-400 uppercase tracking-wide">
          Agent Controls
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
          <AgentJobCard
            title="Summarizing"
            pendingCount={
              // Sum of to_summarize (210) + summarizing (211)
              ((allStatusData?.find((s: { code: number }) => s.code === 210)?.count as number) ||
                0) +
              ((allStatusData?.find((s: { code: number }) => s.code === 211)?.count as number) || 0)
            }
            agentName="summarizer"
            color="emerald"
          />
          <AgentJobCard
            title="Tagging"
            pendingCount={
              // Sum of to_tag (220) + tagging (221)
              ((allStatusData?.find((s: { code: number }) => s.code === 220)?.count as number) ||
                0) +
              ((allStatusData?.find((s: { code: number }) => s.code === 221)?.count as number) || 0)
            }
            agentName="tagger"
            color="violet"
          />
          <AgentJobCard
            title="Thumbnailing"
            pendingCount={
              // Sum of to_thumbnail (230) + thumbnailing (231)
              ((allStatusData?.find((s: { code: number }) => s.code === 230)?.count as number) ||
                0) +
              ((allStatusData?.find((s: { code: number }) => s.code === 231)?.count as number) || 0)
            }
            agentName="thumbnailer"
            color="cyan"
          />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4 mt-3">
          <DiscoveryControlCard />
        </div>
      </div>

      {/* Issues / Alerts Section */}
      {(failedLast24h > 0 || pendingProposals > 0) && (
        <div className="space-y-3">
          <h2 className="text-xs md:text-sm font-medium text-neutral-400 uppercase tracking-wide">
            Issues requiring attention
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {failedLast24h > 0 && (
              <Link
                href="/items?status=failed"
                className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 hover:bg-red-500/15 transition-colors"
              >
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="text-sm font-medium text-red-300">
                    {failedLast24h} item{failedLast24h === 1 ? '' : 's'} failed in the last 24h
                  </p>
                  <p className="text-xs text-red-400/70">Click to view failed items</p>
                </div>
              </Link>
            )}
            {pendingProposals > 0 && (
              <Link
                href="/entities"
                className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 hover:bg-amber-500/15 transition-colors"
              >
                <span className="text-2xl">📥</span>
                <div>
                  <p className="text-sm font-medium text-amber-300">
                    {pendingProposals} entity proposal{pendingProposals === 1 ? '' : 's'} pending
                  </p>
                  <p className="text-xs text-amber-400/70">Review proposed entities</p>
                </div>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Recent Failures */}
      {recentFailures.length > 0 && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6">
          <h2 className="text-lg font-semibold text-red-300 mb-4">Recent Failures</h2>
          <div className="space-y-3">
            {recentFailures.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between rounded-lg bg-neutral-900/60 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-neutral-300 truncate">
                    {item.payload?.title || item.url}
                  </p>
                  <p className="text-xs text-red-400 mt-1">
                    {item.payload?.error || 'Unknown error'}
                  </p>
                </div>
                <a
                  href={`/items/${item.id}`}
                  className="ml-4 text-xs text-sky-400 hover:text-sky-300"
                >
                  View
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
