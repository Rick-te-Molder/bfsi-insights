import { createServiceRoleClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type SupabaseClient = ReturnType<typeof createServiceRoleClient>;

async function getProcessingCount(supabase: SupabaseClient) {
  const { count } = await supabase
    .from('ingestion_queue')
    .select('*', { count: 'exact', head: true })
    .gt('status_code', 200)
    .lt('status_code', 300);
  return count || 0;
}

async function getRecentFailedCount(supabase: SupabaseClient) {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('ingestion_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status_code', 500)
    .gte('updated_at', oneDayAgo);
  return count || 0;
}

async function getPendingReviewCount(supabase: SupabaseClient) {
  const { count } = await supabase
    .from('ingestion_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status_code', 300);
  return count || 0;
}

async function getLastQueueRun(supabase: SupabaseClient) {
  const { data } = await supabase
    .from('ingestion_queue')
    .select('updated_at')
    .in('status_code', [300, 330, 500])
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();
  return data?.updated_at || null;
}

async function getLastBuildTime(supabase: SupabaseClient) {
  const { data } = await supabase
    .from('kb_publication')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  return data?.created_at || null;
}

function determineStatus(processingCount: number, recentFailedCount: number) {
  if (processingCount > 0) return 'processing';
  if (recentFailedCount > 5) return 'degraded';
  return 'idle';
}

export async function GET() {
  const supabase = createServiceRoleClient();

  try {
    const [processingCount, recentFailedCount, pendingReviewCount, lastQueueRun, lastBuildTime] =
      await Promise.all([
        getProcessingCount(supabase),
        getRecentFailedCount(supabase),
        getPendingReviewCount(supabase),
        getLastQueueRun(supabase),
        getLastBuildTime(supabase),
      ]);

    return NextResponse.json({
      status: determineStatus(processingCount, recentFailedCount),
      processingCount,
      pendingReviewCount,
      recentFailedCount,
      lastQueueRun,
      lastBuildTime,
    });
  } catch (error) {
    console.error('Pipeline status error:', error);
    return NextResponse.json(
      { status: 'unknown', error: 'Failed to fetch status' },
      { status: 500 },
    );
  }
}
