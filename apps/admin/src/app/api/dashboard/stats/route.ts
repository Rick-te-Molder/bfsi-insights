import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

/**
 * KB-277: API endpoint for dashboard stats polling
 * Returns pipeline status counts for live updates
 */
function getTodayStart(): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.toISOString();
}

async function fetchActivityStats(
  supabase: ReturnType<typeof createServiceRoleClient>,
  todayISO: string,
) {
  const [{ count: discoveredToday }, { count: processedToday }] = await Promise.all([
    supabase
      .from('ingestion_queue')
      .select('*', { count: 'exact', head: true })
      .gte('discovered_at', todayISO),
    supabase
      .from('ingestion_queue')
      .select('*', { count: 'exact', head: true })
      .gte('status_code', 300)
      .lt('status_code', 500)
      .gte('updated_at', todayISO),
  ]);
  return { discovered: discoveredToday || 0, processed: processedToday || 0 };
}

export async function GET() {
  try {
    const supabase = createServiceRoleClient();
    const { data: statusData, error } = await supabase.rpc('get_status_code_counts');

    if (error) {
      console.error('Failed to get pipeline status counts:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const activityToday = await fetchActivityStats(supabase, getTodayStart());

    return NextResponse.json({
      statusData: statusData || [],
      activityToday,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
