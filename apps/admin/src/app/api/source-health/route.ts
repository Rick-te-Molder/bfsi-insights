import { createServiceRoleClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface SourceHealth {
  source_slug: string;
  last_discovery: string | null;
  items_7d: number;
  items_30d: number;
  failed_7d: number;
  total_7d: number;
  error_rate: number;
  health_status: 'healthy' | 'warning' | 'error' | 'inactive';
}

type SourceStats = {
  lastDiscovery: string | null;
  items7d: number;
  items30d: number;
  failed7d: number;
  total7d: number;
};

function getTimestamps() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  return { now, sevenDaysAgo, thirtyDaysAgo };
}

function updateStats(
  stats: SourceStats,
  item: { payload: unknown; status_code: number; discovered_at: string },
  sevenDaysAgo: string,
) {
  const sourceSlug = (item.payload as { source_slug?: string })?.source_slug;
  if (!sourceSlug) return null;

  const isLast7Days = new Date(item.discovered_at) >= new Date(sevenDaysAgo);
  stats.items30d++;
  if (isLast7Days) {
    stats.items7d++;
    stats.total7d++;
    if (item.status_code === 500) stats.failed7d++;
  }

  if (!stats.lastDiscovery || item.discovered_at > stats.lastDiscovery) {
    stats.lastDiscovery = item.discovered_at;
  }
  return sourceSlug;
}

function getHealthStatus(stats: SourceStats, now: Date): SourceHealth['health_status'] {
  const daysSinceLastDiscovery = stats.lastDiscovery
    ? (now.getTime() - new Date(stats.lastDiscovery).getTime()) / (24 * 60 * 60 * 1000)
    : Infinity;

  const errorRate = stats.total7d > 0 ? stats.failed7d / stats.total7d : 0;

  if (daysSinceLastDiscovery > 7) return 'inactive';
  if (errorRate > 0.3) return 'error';
  if (errorRate > 0.1 || stats.items7d < 2) return 'warning';
  return 'healthy';
}

function buildHealthItem(sourceSlug: string, stats: SourceStats, now: Date): SourceHealth {
  const errorRate = stats.total7d > 0 ? stats.failed7d / stats.total7d : 0;
  return {
    source_slug: sourceSlug,
    last_discovery: stats.lastDiscovery,
    items_7d: stats.items7d,
    items_30d: stats.items30d,
    failed_7d: stats.failed7d,
    total_7d: stats.total7d,
    error_rate: Math.round(errorRate * 100),
    health_status: getHealthStatus(stats, now),
  };
}

export async function GET() {
  const supabase = createServiceRoleClient();

  try {
    const { now, sevenDaysAgo, thirtyDaysAgo } = getTimestamps();

    // Get all items from last 30 days with source info
    const { data: recentItems, error } = await supabase
      .from('ingestion_queue')
      .select('payload, status_code, discovered_at')
      .gte('discovered_at', thirtyDaysAgo);

    if (error) {
      console.error('Error fetching source health:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const sourceStats = await aggregateSourceStats(recentItems || [], sevenDaysAgo);
    const healthData = buildHealthData(sourceStats, now);

    return NextResponse.json({ health: healthData });
  } catch (error) {
    console.error('Source health error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

async function aggregateSourceStats(
  recentItems: { payload: unknown; status_code: number; discovered_at: string }[],
  sevenDaysAgo: string,
) {
  const sourceStats = new Map<string, SourceStats>();

  for (const item of recentItems) {
    let stats = sourceStats.get((item.payload as { source_slug?: string })?.source_slug || '');
    if (!stats) {
      stats = {
        lastDiscovery: null,
        items7d: 0,
        items30d: 0,
        failed7d: 0,
        total7d: 0,
      };
      sourceStats.set((item.payload as { source_slug?: string })?.source_slug || '', stats);
    }

    const sourceSlug = updateStats(stats, item, sevenDaysAgo);
    if (sourceSlug) sourceStats.set(sourceSlug, stats);
  }

  return sourceStats;
}

function buildHealthData(sourceStats: Map<string, SourceStats>, now: Date) {
  const healthData: SourceHealth[] = [];
  sourceStats.forEach((stats, sourceSlug) => {
    healthData.push(buildHealthItem(sourceSlug, stats, now));
  });
  return healthData;
}
