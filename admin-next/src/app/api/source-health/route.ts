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

export async function GET() {
  const supabase = createServiceRoleClient();

  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Get all items from last 30 days with source info
    const { data: recentItems, error } = await supabase
      .from('ingestion_queue')
      .select('payload, status, discovered_at')
      .gte('discovered_at', thirtyDaysAgo);

    if (error) {
      console.error('Error fetching source health:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Aggregate by source
    const sourceStats = new Map<
      string,
      {
        lastDiscovery: string | null;
        items7d: number;
        items30d: number;
        failed7d: number;
        total7d: number;
      }
    >();

    for (const item of recentItems || []) {
      const sourceSlug = (item.payload as { source_slug?: string })?.source_slug;
      if (!sourceSlug) continue;

      const discoveredAt = item.discovered_at;
      const isLast7Days = new Date(discoveredAt) >= new Date(sevenDaysAgo);

      let stats = sourceStats.get(sourceSlug);
      if (!stats) {
        stats = {
          lastDiscovery: null,
          items7d: 0,
          items30d: 0,
          failed7d: 0,
          total7d: 0,
        };
        sourceStats.set(sourceSlug, stats);
      }

      // Update last discovery
      if (!stats.lastDiscovery || discoveredAt > stats.lastDiscovery) {
        stats.lastDiscovery = discoveredAt;
      }

      // Count items
      stats.items30d++;
      if (isLast7Days) {
        stats.items7d++;
        stats.total7d++;
        if (item.status === 'failed') {
          stats.failed7d++;
        }
      }
    }

    // Convert to response format with health status
    const healthData: SourceHealth[] = [];

    sourceStats.forEach((stats, sourceSlug) => {
      const errorRate = stats.total7d > 0 ? stats.failed7d / stats.total7d : 0;

      // Determine health status
      let healthStatus: SourceHealth['health_status'] = 'healthy';

      const daysSinceLastDiscovery = stats.lastDiscovery
        ? (now.getTime() - new Date(stats.lastDiscovery).getTime()) / (24 * 60 * 60 * 1000)
        : Infinity;

      if (daysSinceLastDiscovery > 7) {
        healthStatus = 'inactive';
      } else if (errorRate > 0.3) {
        healthStatus = 'error';
      } else if (errorRate > 0.1 || stats.items7d < 2) {
        healthStatus = 'warning';
      }

      healthData.push({
        source_slug: sourceSlug,
        last_discovery: stats.lastDiscovery,
        items_7d: stats.items7d,
        items_30d: stats.items30d,
        failed_7d: stats.failed7d,
        total_7d: stats.total7d,
        error_rate: Math.round(errorRate * 100),
        health_status: healthStatus,
      });
    });

    return NextResponse.json({ health: healthData });
  } catch (error) {
    console.error('Source health error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
