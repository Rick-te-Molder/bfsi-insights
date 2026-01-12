import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getStatusCode, resolveQueueItemForEnrichment } from '@/app/api/_lib/reenrich-queue';

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

function getReturnStatus(
  currentStatus: number,
  _publishedCode: number,
  pendingReviewCode: number,
  _enrichedCode: number,
): number | null {
  // Items in enrichment phase (200-239) should continue normal flow
  const isInEnrichmentPhase = currentStatus >= 200 && currentStatus < 240;
  if (isInEnrichmentPhase) return null;

  // All non-enrichment items (review 300s, published 400s) return to pending_review
  // This ensures re-enriched items get human review before republishing
  return pendingReviewCode;
}

async function cancelRunningPipeline(
  supabase: ReturnType<typeof createServiceRoleClient>,
  id: string,
) {
  // Cancel any running pipeline - ASMM Phase 1: No silent fails
  const { error } = await supabase
    .from('pipeline_run')
    .update({ status: 'cancelled', completed_at: new Date().toISOString() })
    .eq('queue_id', id)
    .eq('status', 'running');
  if (error) {
    throw new Error(`Failed to cancel running pipeline for ${id}: ${error.message}`);
  }
}

async function createPipelineRun(
  supabase: ReturnType<typeof createServiceRoleClient>,
  id: string,
  _step: StepName,
) {
  // Create new pipeline run - ASMM Phase 1: No silent fails
  // trigger must be one of: 'discovery', 'manual', 're-enrich', 'retry'
  const result = await supabase
    .from('pipeline_run')
    .insert({
      queue_id: id,
      trigger: 're-enrich',
      status: 'running',
      created_by: 'system',
    })
    .select('id')
    .single();
  if (result.error) {
    throw new Error(`Failed to create pipeline run for ${id}: ${result.error.message}`);
  }
  return result;
}

function buildSingleStepPayload(
  payload: Record<string, unknown>,
  returnStatus: number | null,
  step: StepName,
) {
  const result: Record<string, unknown> = {
    ...payload,
    _single_step: step,
  };
  // Set or clear _return_status based on whether item is past enrichment phase
  if (returnStatus === null) {
    delete result._return_status;
    delete result._manual_override;
  } else {
    result._return_status = returnStatus;
    // Mark as manual override so state machine allows 400→300 (published→pending_review)
    result._manual_override = true;
  }
  return result;
}

async function updateQueueForSingleStep(
  supabase: ReturnType<typeof createServiceRoleClient>,
  id: string,
  update: {
    statusCode: number | null;
    runId: string | null;
    payload: Record<string, unknown>;
  },
) {
  // For independent step runs (statusCode=null), don't update status
  // The state machine trigger blocks invalid transitions like 210→230
  const updateData: Record<string, unknown> = {
    current_run_id: update.runId,
    payload: update.payload,
  };
  if (update.statusCode !== null) {
    updateData.status_code = update.statusCode;
  }
  // ASMM Phase 1: No silent fails - always check for errors
  const { error } = await supabase.from('ingestion_queue').update(updateData).eq('id', id);
  if (error) {
    throw new Error(`Failed to update queue item ${id}: ${error.message}`);
  }
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

async function computeReturnStatus(
  supabase: ReturnType<typeof createServiceRoleClient>,
  currentStatus: number,
) {
  const { publishedCode, pendingReviewCode, enrichedCode } = await loadStatusCodes(supabase);
  return getReturnStatus(currentStatus, publishedCode, pendingReviewCode, enrichedCode);
}

async function runEnrichStep(step: StepName, id: string) {
  const supabase = createServiceRoleClient();
  const config = getStepConfig(step);

  const { queueId, item: currentItem } = await resolveQueueItemForEnrichment(supabase, id);
  if (!currentItem || !queueId)
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });

  const returnStatus = await computeReturnStatus(supabase, currentItem.status_code);
  // For review/published items (returnStatus!=null), do NOT update status_code.
  // The state machine trigger blocks transitions like 400→230.
  // We still set _single_step and _return_status so the agent can run the step.
  const statusCode =
    returnStatus === null ? await getStatusCode(supabase, config.statusName) : null;

  await cancelRunningPipeline(supabase, queueId);
  const { data: newRun } = await createPipelineRun(supabase, queueId, step);
  await updateQueueForSingleStep(supabase, queueId, {
    statusCode,
    runId: newRun?.id || null,
    payload: buildSingleStepPayload(currentItem.payload, returnStatus, step),
  });

  const result = await callAgentApi(config.endpoint, queueId, step);
  return NextResponse.json(result.data, { status: result.status });
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
