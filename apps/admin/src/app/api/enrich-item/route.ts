import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  resolveQueueIdForEnrichment,
  prepareQueueForFullReenrich,
} from '@/app/api/_lib/reenrich-queue';

const AGENT_API_URL = process.env.AGENT_API_URL || 'http://localhost:3001';
const AGENT_API_KEY = process.env.AGENT_API_KEY || '';

async function parseRequestId(request: NextRequest): Promise<string> {
  const body = await request.json();
  const { id } = body as { id?: unknown };
  if (typeof id !== 'string' || !id) throw new Error('id is required');
  return id;
}

async function callAgentApi(queueId: string) {
  const res = await fetch(`${AGENT_API_URL}/api/agents/enrich-item`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': AGENT_API_KEY,
    },
    body: JSON.stringify({ id: queueId }),
  });

  const text = await res.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    const preview = text.substring(0, 100).replaceAll(/\s+/g, ' ');
    return { ok: false, status: 503, data: { error: `Agent API unavailable: ${preview}...` } };
  }

  return { ok: res.ok, status: res.status, data };
}

export async function POST(request: NextRequest) {
  try {
    if (!AGENT_API_KEY) {
      return NextResponse.json({ error: 'AGENT_API_KEY not configured' }, { status: 500 });
    }

    const id = await parseRequestId(request);

    const supabase = createServiceRoleClient();
    const queueId = await resolveQueueIdForEnrichment(supabase, id);
    if (!queueId) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Prepare queue item for full re-enrichment (reset status, set manual override)
    await prepareQueueForFullReenrich(supabase, queueId);

    const result = await callAgentApi(queueId);
    return NextResponse.json(result.data, { status: result.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Enrich item error:', message, error);

    if (message === 'id is required') {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ error: message || 'Unknown error' }, { status: 500 });
  }
}
