import { createServiceRoleClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceRoleClient();

  let notes: string | undefined;
  try {
    const body = await request.json();
    notes = body.notes;
  } catch {
    // No body is fine
  }

  const { data, error } = await supabase.rpc('approve_proposed_entity', {
    p_proposal_id: id,
    p_notes: notes,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data?.success) {
    return NextResponse.json({ error: data?.error || 'Failed to approve' }, { status: 400 });
  }

  return NextResponse.json(data);
}
