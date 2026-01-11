import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

const AGENT_API_URL = process.env.AGENT_API_URL || 'http://localhost:3001';
const AGENT_API_KEY = process.env.AGENT_API_KEY || '';

type StepName = 'summarize' | 'tag' | 'thumbnail';

type StepConfig = { statusName: string; endpoint: string };

type StepRequest = { step: StepName; id: string };

function isStepName(value: unknown): value is StepName {
  return value === 'summarize' || value === 'tag' || value === 'thumbnail';
}

async function parseStepRequest(request: NextRequest): Promise<StepRequest> {
  const body = await request.json();
  const { step, id } = body as { step?: unknown; id?: unknown };

  if (!isStepName(step) || typeof id !== 'string' || !id) {
    throw new Error('step and id are required');
  }

  return { step, id };
}

function getStepConfig(step: StepName): StepConfig {
  // Map step to status name and agent API endpoint
  // All steps use the single orchestrated endpoint
  const stepConfig: Record<StepName, StepConfig> = {
    summarize: { statusName: 'to_summarize', endpoint: '/api/agents/enrich-single-step' },
    tag: { statusName: 'to_tag', endpoint: '/api/agents/enrich-single-step' },
    thumbnail: { statusName: 'to_thumbnail', endpoint: '/api/agents/enrich-single-step' },
  };

  return stepConfig[step];
}

async function loadStatusCodes(supabase: ReturnType<typeof createServiceRoleClient>) {
  // KB-202: Load status codes from status_lookup
  const publishedCode = await getStatusCode(supabase, 'published');
  const pendingReviewCode = await getStatusCode(supabase, 'pending_review');
  const enrichedCode = await getStatusCode(supabase, 'enriched');
  return { publishedCode, pendingReviewCode, enrichedCode };
}

async function fetchQueueItem(supabase: ReturnType<typeof createServiceRoleClient>, id: string) {
  // Fetch current item
  return supabase.from('ingestion_queue').select('payload, status_code').eq('id', id).single();
}

async function cancelRunningPipeline(
  supabase: ReturnType<typeof createServiceRoleClient>,
  id: string,
) {
  // Cancel any running pipeline
  await supabase
    .from('pipeline_run')
    .update({ status: 'cancelled', completed_at: new Date().toISOString() })
    .eq('queue_id', id)
    .eq('status', 'running');
}

async function createPipelineRun(
  supabase: ReturnType<typeof createServiceRoleClient>,
  id: string,
  step: StepName,
) {
  // Create new pipeline run
  return supabase
    .from('pipeline_run')
    .insert({
      queue_id: id,
      trigger: `re-${step}`,
      status: 'running',
      created_by: 'system',
    })
    .select('id')
    .single();
}

function buildSingleStepPayload(
  payload: Record<string, unknown>,
  returnStatus: number,
  step: StepName,
) {
  return {
    ...payload,
    _return_status: returnStatus,
    _single_step: step,
  };
}

async function updateQueueForSingleStep(
  supabase: ReturnType<typeof createServiceRoleClient>,
  id: string,
  update: {
    statusCode: number;
    runId: string | null;
    payload: Record<string, unknown>;
  },
) {
  // Update status and set return_status in payload
  await supabase
    .from('ingestion_queue')
    .update({
      status_code: update.statusCode,
      current_run_id: update.runId,
      payload: update.payload,
    })
    .eq('id', id);
}

async function callAgentApi(endpoint: string, id: string, step: StepName) {
  const res = await fetch(`${AGENT_API_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': AGENT_API_KEY },
    body: JSON.stringify({ id, step }),
  });

  const text = await res.text();
  try {
    return { data: JSON.parse(text), status: res.status };
  } catch {
    // Agent API returned non-JSON (e.g., HTML error page when service is down)
    const preview = text.substring(0, 100).replaceAll(/\s+/g, ' ');
    return { data: { error: `Agent API unavailable: ${preview}...` }, status: 503 };
  }
}

async function runEnrichStep(step: StepName, id: string) {
  const supabase = createServiceRoleClient();
  const config = getStepConfig(step);

  // KB-202: Load status codes from status_lookup
  const statusCode = await getStatusCode(supabase, config.statusName);
  const { publishedCode, pendingReviewCode, enrichedCode } = await loadStatusCodes(supabase);

  const { data: currentItem } = await fetchQueueItem(supabase, id);
  if (!currentItem) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

  // Determine return status
  const isPublished = currentItem.status_code === publishedCode;
  const returnStatus = isPublished ? pendingReviewCode : enrichedCode;

  await cancelRunningPipeline(supabase, id);
  const { data: newRun } = await createPipelineRun(supabase, id, step);
  await updateQueueForSingleStep(supabase, id, {
    statusCode,
    runId: newRun?.id || null,
    payload: buildSingleStepPayload(currentItem.payload, returnStatus, step),
  });

  const result = await callAgentApi(config.endpoint, id, step);
  return NextResponse.json(result.data, { status: result.status });
}

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
    const { step, id } = await parseStepRequest(request);
    return await runEnrichStep(step, id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Enrich step error:', message, error);

    if (error instanceof Error && error.message === 'step and id are required') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Surface actual error message instead of generic message
    return NextResponse.json(
      { error: `Failed to run enrichment step: ${message}` },
      { status: 500 },
    );
  }
}
