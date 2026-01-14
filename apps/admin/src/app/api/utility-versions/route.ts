import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from('utility_version').select('agent_name, version');
  if (error) {
    return NextResponse.json([], { status: 200 });
  }
  return NextResponse.json(data || []);
}
