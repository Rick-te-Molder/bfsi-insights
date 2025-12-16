import Link from 'next/link';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { PipelineStatusGrid } from '@/components/dashboard/PipelineStatusGrid';
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

async function getStats() {
  const supabase = createServiceRoleClient();

  // Get counts by status_code ranges for pipeline view
  const [
    { count: pendingEnrichment },
    { count: inEnrichment },
    { count: pendingReview },
    { count: approved },
    { count: failed },
    { count: rejected },
  ] = await Promise.all([
    // Pending enrichment (200)
    supabase
      .from('ingestion_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status_code', STATUS.PENDING_ENRICHMENT),
    // In enrichment (201-239)
    supabase
      .from('ingestion_queue')
      .select('*', { count: 'exact', head: true })
      .gt('status_code', STATUS.PENDING_ENRICHMENT)
      .lt('status_code', STATUS.ENRICHED),
    // Pending review (300)
    supabase
      .from('ingestion_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status_code', STATUS.PENDING_REVIEW),
    // Approved (330)
    supabase
      .from('ingestion_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status_code', STATUS.APPROVED),
    // Failed (500)
    supabase
      .from('ingestion_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status_code', STATUS.FAILED),
    // Rejected (540)
    supabase
      .from('ingestion_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status_code', STATUS.REJECTED),
  ]);

  // Legacy status counts for backward compatibility
  const statusCounts = {
    pending: pendingEnrichment || 0,
    processing: inEnrichment || 0,
    enriched: pendingReview || 0,
    approved: approved || 0,
    failed: failed || 0,
    rejected: rejected || 0,
    // New granular counts
    pendingEnrichment: pendingEnrichment || 0,
    inEnrichment: inEnrichment || 0,
    pendingReview: pendingReview || 0,
  };

  // Calculate success rate (last 7 days) using status_code
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count: recentSuccessCount } = await supabase
    .from('ingestion_queue')
    .select('*', { count: 'exact', head: true })
    .gte('status_code', STATUS.PENDING_REVIEW)
    .lt('status_code', STATUS.FAILED)
    .gte('updated_at', sevenDaysAgo);

  const { count: recentTotalCount } = await supabase
    .from('ingestion_queue')
    .select('*', { count: 'exact', head: true })
    .gte('updated_at', sevenDaysAgo);

  const successRate = recentTotalCount ? ((recentSuccessCount || 0) / recentTotalCount) * 100 : 0;

  // Skip avg processing time for now (requires payload access)
  const avgProcessingTime = 0;

  // Get recent failures
  const { data: recentFailures } = await supabase
    .from('ingestion_queue')
    .select('id, url, payload, updated_at')
    .eq('status_code', STATUS.FAILED)
    .order('updated_at', { ascending: false })
    .limit(5);

  // Get failed count in last 24h for alerts
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: failedLast24h } = await supabase
    .from('ingestion_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status_code', STATUS.FAILED)
    .gte('updated_at', oneDayAgo);

  // Get sources with no items in last 72h (potential dead sources)
  const threeDaysAgo = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
  const { data: recentSources } = await supabase
    .from('ingestion_queue')
    .select('payload')
    .gte('discovered_at', threeDaysAgo);

  const activeSourceSlugs = new Set(
    (recentSources || [])
      .map((r) => (r.payload as { source_slug?: string })?.source_slug)
      .filter(Boolean),
  );

  // Queue age metrics - oldest pending items
  const { data: oldestPending } = await supabase
    .from('ingestion_queue')
    .select('discovered_at')
    .eq('status_code', STATUS.PENDING_ENRICHMENT)
    .order('discovered_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: oldestQueued } = await supabase
    .from('ingestion_queue')
    .select('discovered_at')
    .gt('status_code', STATUS.PENDING_ENRICHMENT)
    .lt('status_code', STATUS.PENDING_REVIEW)
    .order('discovered_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  // Calculate age in hours
  const getAgeHours = (dateStr: string | null) => {
    if (!dateStr) return 0;
    return Math.round((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60));
  };

  const oldestPendingAge = getAgeHours(oldestPending?.discovered_at);
  const oldestQueuedAge = getAgeHours(oldestQueued?.discovered_at);

  // Items discovered today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { count: discoveredToday } = await supabase
    .from('ingestion_queue')
    .select('*', { count: 'exact', head: true })
    .gte('discovered_at', todayStart.toISOString());

  // Items processed today (status changed from pending/queued)
  const { count: enrichedToday } = await supabase
    .from('ingestion_queue')
    .select('*', { count: 'exact', head: true })
    .in('status_code', [300, 330, 540, 500])
    .gte('updated_at', todayStart.toISOString());

  // Get publication count
  const { count: publishedCount } = await supabase
    .from('kb_publication')
    .select('*', { count: 'exact', head: true });

  // Get active A/B tests
  const { count: activeTests } = await supabase
    .from('prompt_ab_test')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'running');

  // Get pending proposals
  const { count: pendingProposals } = await supabase
    .from('proposed_entity')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  // Get all status codes with counts directly from database (MECE)
  const { data: allStatusData } = await supabase.rpc('get_status_code_counts');

  return {
    statusCounts,
    recentFailures: recentFailures || [],
    publishedCount: publishedCount || 0,
    successRate,
    avgProcessingTime,
    recentItemsCount: recentTotalCount || 0,
    failedCount: statusCounts.failed || 0,
    activeTests: activeTests || 0,
    pendingProposals: pendingProposals || 0,
    failedLast24h: failedLast24h || 0,
    activeSourceCount: activeSourceSlugs.size,
    // New queue metrics
    oldestPendingAge,
    oldestQueuedAge,
    discoveredToday: discoveredToday || 0,
    enrichedToday: enrichedToday || 0,
    allStatusData,
  };
}

export default async function DashboardPage() {
  const {
    statusCounts,
    recentFailures,
    publishedCount: _publishedCount,
    successRate,
    recentItemsCount,
    activeTests,
    pendingProposals,
    failedLast24h,
    oldestPendingAge: _oldestPendingAge,
    oldestQueuedAge: _oldestQueuedAge,
    discoveredToday,
    enrichedToday,
    allStatusData,
  } = await getStats();

  // Format age for display (reserved for future use)
  const _formatAge = (hours: number) => {
    if (hours === 0) return '-';
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  };

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <header>
        <h1 className="text-xl md:text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-sm text-neutral-400">Overview of the ingestion pipeline</p>
      </header>

      {/* Activity Today */}
      <div className="space-y-3">
        <h2 className="text-xs md:text-sm font-medium text-neutral-400 uppercase tracking-wide">
          Activity Today
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 md:p-4">
            <p className="text-xs md:text-sm text-neutral-400">Discovered Today</p>
            <p className="mt-1 text-xl md:text-2xl font-bold text-violet-400">{discoveredToday}</p>
            <p className="text-[10px] md:text-xs text-neutral-500">New items found</p>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 md:p-4">
            <p className="text-xs md:text-sm text-neutral-400">Processed Today</p>
            <p className="mt-1 text-xl md:text-2xl font-bold text-emerald-400">{enrichedToday}</p>
            <p className="text-[10px] md:text-xs text-neutral-500">Enriched + reviewed</p>
          </div>
          <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3 md:p-4">
            <p className="text-xs md:text-sm text-neutral-400">Total in Pipeline</p>
            <p className="mt-1 text-xl md:text-2xl font-bold text-sky-400">
              {(statusCounts.pending || 0) +
                (statusCounts.processing || 0) +
                (statusCounts.enriched || 0)}
            </p>
            <p className="text-[10px] md:text-xs text-neutral-500">Awaiting action</p>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 md:p-4">
            <p className="text-xs md:text-sm text-neutral-400">Success Rate (7d)</p>
            <p className="mt-1 text-xl md:text-2xl font-bold text-amber-400">
              {successRate.toFixed(1)}%
            </p>
            <p className="text-[10px] md:text-xs text-neutral-500">{recentItemsCount} items</p>
          </div>
        </div>
      </div>

      {/* Detailed Pipeline Status */}
      <div className="space-y-3">
        <h2 className="text-xs md:text-sm font-medium text-neutral-400 uppercase tracking-wide">
          Pipeline Status by Code
        </h2>
        <PipelineStatusGrid statusData={allStatusData} />
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

      {/* Other Metrics */}
      <div className="grid grid-cols-2 gap-3 md:gap-4">
        <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3 md:p-4">
          <p className="text-xs md:text-sm text-neutral-400">Active A/B Tests</p>
          <p className="mt-1 text-xl md:text-2xl font-bold text-purple-400">{activeTests}</p>
          <Link href="/ab-tests" className="text-xs text-purple-400 hover:text-purple-300">
            View tests →
          </Link>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 md:p-4">
          <p className="text-xs md:text-sm text-neutral-400">Pending Proposals</p>
          <p className="mt-1 text-xl md:text-2xl font-bold text-amber-400">{pendingProposals}</p>
          <Link href="/proposals" className="text-xs text-amber-400 hover:text-amber-300">
            Review proposals →
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Review Queue CTA */}
        <Link
          href="/review"
          className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6 hover:border-sky-500/50 transition-all group hover:scale-[1.02]"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold group-hover:text-sky-400 transition-colors flex items-center gap-2">
                Review Queue
                <span className="text-neutral-600 group-hover:text-sky-400/50 transition-colors">
                  →
                </span>
              </h2>
              <p className="mt-0.5 text-xs text-neutral-500">Triage and approve new content</p>
              <p className="mt-2 text-sm text-neutral-300">
                {statusCounts.enriched || 0} items waiting
              </p>
            </div>
            <span className="text-3xl opacity-80 group-hover:opacity-100 transition-opacity">
              📋
            </span>
          </div>
        </Link>

        {/* Prompts CTA */}
        <Link
          href="/prompts"
          className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6 hover:border-purple-500/50 transition-all group hover:scale-[1.02]"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold group-hover:text-purple-400 transition-colors flex items-center gap-2">
                Prompt Engineering
                <span className="text-neutral-600 group-hover:text-purple-400/50 transition-colors">
                  →
                </span>
              </h2>
              <p className="mt-0.5 text-xs text-neutral-500">Edit and test agent prompts</p>
              <p className="mt-2 text-sm text-neutral-300">Manage prompt versions</p>
            </div>
            <span className="text-3xl opacity-80 group-hover:opacity-100 transition-opacity">
              💬
            </span>
          </div>
        </Link>

        {/* Golden Sets CTA */}
        <Link
          href="/golden-sets"
          className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6 hover:border-amber-500/50 transition-all group hover:scale-[1.02]"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold group-hover:text-amber-400 transition-colors flex items-center gap-2">
                Golden Sets
                <span className="text-neutral-600 group-hover:text-amber-400/50 transition-colors">
                  →
                </span>
              </h2>
              <p className="mt-0.5 text-xs text-neutral-500">Maintain evaluation datasets</p>
              <p className="mt-2 text-sm text-neutral-300">Test prompts against curated cases</p>
            </div>
            <span className="text-3xl opacity-80 group-hover:opacity-100 transition-opacity">
              ⭐
            </span>
          </div>
        </Link>
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
                href="/review?status=failed"
                className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 hover:bg-red-500/15 transition-colors"
              >
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="text-sm font-medium text-red-300">
                    {failedLast24h} item{failedLast24h !== 1 ? 's' : ''} failed in the last 24h
                  </p>
                  <p className="text-xs text-red-400/70">Click to view failed items</p>
                </div>
              </Link>
            )}
            {pendingProposals > 0 && (
              <Link
                href="/proposals"
                className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 hover:bg-amber-500/15 transition-colors"
              >
                <span className="text-2xl">📥</span>
                <div>
                  <p className="text-sm font-medium text-amber-300">
                    {pendingProposals} entity proposal{pendingProposals !== 1 ? 's' : ''} pending
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
                  href={`/review/${item.id}`}
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
