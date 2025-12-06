import { createServiceRoleClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET: Fetch pending proposals
export async function GET() {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase.from('pending_entity_proposals').select('*');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST: Create a new proposal (used by agent-api or manual creation)
export async function POST(request: NextRequest) {
  const supabase = createServiceRoleClient();
  const body = await request.json();

  const { entity_type, name, slug, metadata, source_queue_id, source_url } = body;

  if (!entity_type || !name || !slug) {
    return NextResponse.json(
      { error: 'entity_type, name, and slug are required' },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from('proposed_entity')
    .insert({
      entity_type,
      name,
      slug,
      metadata: metadata || {},
      source_queue_id,
      source_url,
    })
    .select()
    .single();

  if (error) {
    // Check if it's a duplicate
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'A pending proposal for this entity already exists' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
