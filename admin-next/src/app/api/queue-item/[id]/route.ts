import { createServiceRoleClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceRoleClient();

  // Fetch item
  const { data: item, error: itemError } = await supabase
    .from('ingestion_queue')
    .select('*')
    .eq('id', id)
    .single();

  if (itemError || !item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }

  // Fetch lookup tables for validation
  const [regulatorsRes, standardSettersRes, orgsRes, vendorsRes] = await Promise.all([
    supabase.from('regulator').select('slug'),
    supabase.from('standard_setter').select('slug'),
    supabase.from('bfsi_organization').select('slug'),
    supabase.from('ag_vendor').select('slug'),
  ]);

  const lookups = {
    regulators: (regulatorsRes.data || []).map((r) => r.slug),
    standardSetters: (standardSettersRes.data || []).map((s) => s.slug),
    organizations: (orgsRes.data || []).map((o) => o.slug),
    vendors: (vendorsRes.data || []).map((v) => v.slug),
  };

  return NextResponse.json({ item, lookups });
}
