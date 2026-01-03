import { createServiceRoleClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createServiceRoleClient();

  try {
    // Get processing count
    const { count: processingCount } = await supabase
      .from('ingestion_queue')
      .select('*', { count: 'exact', head: true })
      .gt('status_code', 200)
      .lt('status_code', 300);

    // Get failed count (last 24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentFailedCount } = await supabase
      .from('ingestion_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status_code', 500)
      .gte('updated_at', oneDayAgo);

    // Get pending review count
    const { count: pendingReviewCount } = await supabase
      .from('ingestion_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status_code', 300);

    // Get last queue run (most recent processing or enriched item)
    const { data: lastProcessed } = await supabase
      .from('ingestion_queue')
      .select('updated_at')
      .in('status_code', [300, 330, 500])
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    // Get last build time from kb_publication
    const { data: lastPublished } = await supabase
      .from('kb_publication')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Determine pipeline status
    let status: 'idle' | 'processing' | 'degraded' = 'idle';
    if ((processingCount || 0) > 0) {
      status = 'processing';
    } else if ((recentFailedCount || 0) > 5) {
      status = 'degraded';
    }

    return NextResponse.json({
      status,
      processingCount: processingCount || 0,
      pendingReviewCount: pendingReviewCount || 0,
      recentFailedCount: recentFailedCount || 0,
      lastQueueRun: lastProcessed?.updated_at || null,
      lastBuildTime: lastPublished?.created_at || null,
    });
  } catch (error) {
    console.error('Pipeline status error:', error);
    return NextResponse.json(
      { status: 'unknown', error: 'Failed to fetch status' },
      { status: 500 },
    );
  }
}
