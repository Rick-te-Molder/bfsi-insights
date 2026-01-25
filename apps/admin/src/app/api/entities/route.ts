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

interface EntityRequest {
  entity_type: string;
  name: string;
  slug: string;
  metadata?: Record<string, unknown>;
  source_queue_id?: string;
  source_url?: string;
}

function validateEntityRequest(body: Partial<EntityRequest>): string | null {
  const { entity_type, name, slug } = body;
  if (!entity_type || !name || !slug) {
    return 'entity_type, name, and slug are required';
  }
  return null;
}

function handleEntityError(error: { code?: string; message: string }): NextResponse {
  if (error.code === '23505') {
    return NextResponse.json(
      { error: 'A pending proposal for this entity already exists' },
      { status: 409 },
    );
  }
  return NextResponse.json({ error: error.message }, { status: 500 });
}

// POST: Create a new proposal (used by agent-api or manual creation)
export async function POST(request: NextRequest) {
  const supabase = createServiceRoleClient();
  const body = await request.json();

  const validationError = validateEntityRequest(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('proposed_entity')
    .insert({
      entity_type: body.entity_type,
      name: body.name,
      slug: body.slug,
      metadata: body.metadata || {},
      source_queue_id: body.source_queue_id,
      source_url: body.source_url,
    })
    .select()
    .single();

  if (error) return handleEntityError(error);
  return NextResponse.json(data, { status: 201 });
}
