import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

const AGENT_API_URL = process.env.AGENT_API_URL || 'http://localhost:3001';
const AGENT_API_KEY = process.env.AGENT_API_KEY || '';

// KB-202: Load status codes from status_lookup table (single source of truth)
async function getStatusCode(
  supabase: ReturnType<typeof createServiceRoleClient>,
  name: string,
): Promise<number> {
  const { data } = await supabase.from('status_lookup').select('code').eq('name', name).single();
  if (!data) throw new Error(`Status code not found: ${name}`);
  return data.code;
}

// KB-285: Trigger a single enrichment step for immediate processing
// This route handles pipeline_run management with service role (RLS bypass)
export async function POST(request: NextRequest) {
  try {
    const { step, id } = await request.json();

    if (!step || !id) {
      return NextResponse.json({ error: 'step and id are required' }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    // Map step to status name and agent API endpoint
    const stepConfig: Record<string, { statusName: string; endpoint: string }> = {
      summarize: { statusName: 'to_summarize', endpoint: '/api/agents/run/summarize' },
      tag: { statusName: 'to_tag', endpoint: '/api/agents/run/tag' },
      thumbnail: { statusName: 'to_thumbnail', endpoint: '/api/agents/run/thumbnail' },
    };

    const config = stepConfig[step];
    if (!config) {
      return NextResponse.json({ error: `Unknown step: ${step}` }, { status: 400 });
    }

    // KB-202: Load status codes from status_lookup
    const statusCode = await getStatusCode(supabase, config.statusName);
    const publishedCode = await getStatusCode(supabase, 'published');
    const pendingReviewCode = await getStatusCode(supabase, 'pending_review');
    const enrichedCode = await getStatusCode(supabase, 'enriched');

    // Fetch current item
    const { data: currentItem } = await supabase
      .from('ingestion_queue')
      .select('payload, status_code')
      .eq('id', id)
      .single();

    if (!currentItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Determine return status
    const isPublished = currentItem.status_code === publishedCode;
    const returnStatus = isPublished ? pendingReviewCode : enrichedCode;

    // Cancel any running pipeline
    await supabase
      .from('pipeline_run')
      .update({ status: 'cancelled', completed_at: new Date().toISOString() })
      .eq('queue_id', id)
      .eq('status', 'running');

    // Create new pipeline run
    const { data: newRun } = await supabase
      .from('pipeline_run')
      .insert({
        queue_id: id,
        trigger: `re-${step}`,
        status: 'running',
        created_by: 'system',
      })
      .select('id')
      .single();

    // Update status and set return_status in payload
    await supabase
      .from('ingestion_queue')
      .update({
        status_code: statusCode,
        current_run_id: newRun?.id || null,
        payload: {
          ...currentItem.payload,
          _return_status: returnStatus,
          _single_step: step,
        },
      })
      .eq('id', id);

    // Call agent API
    const res = await fetch(`${AGENT_API_URL}${config.endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': AGENT_API_KEY,
      },
      body: JSON.stringify({ id }),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('Enrich step error:', error);
    return NextResponse.json({ error: 'Failed to run enrichment step' }, { status: 500 });
  }
}
