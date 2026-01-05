import process from 'node:process';
import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  insertTaxonomyTags,
  preparePublicationData,
  upsertPublication,
} from './publication-helpers';
import { coercePayload, updateQueueItem } from './actions-queue';

type Supabase = ReturnType<typeof createServiceRoleClient>;

type BulkResult = { success: true; count: number } | { success: false; error: string };

type StatusCodes = {
  pending_enrichment: number;
  published: number;
  rejected: number;
};

async function cancelRunningPipeline(supabase: Supabase, queueId: string) {
  await supabase
    .from('pipeline_run')
    .update({ status: 'cancelled', completed_at: new Date().toISOString() })
    .eq('queue_id', queueId)
    .eq('status', 'running');
}

async function createPipelineRun(supabase: Supabase, queueId: string, createdBy: string | null) {
  const { data } = await supabase
    .from('pipeline_run')
    .insert({
      queue_id: queueId,
      trigger: 're-enrich',
      status: 'running',
      created_by: createdBy || 'system',
    })
    .select('id')
    .single();

  return data?.id ?? null;
}

async function triggerAgentApiQueue() {
  const agentApiUrl = process.env.AGENT_API_URL || 'https://bfsi-insights.onrender.com';
  const agentApiKey = process.env.AGENT_API_KEY;
  if (!agentApiKey) return;

  fetch(`${agentApiUrl}/api/agents/process-queue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': agentApiKey },
    body: JSON.stringify({ limit: 20, includeThumbnail: true }),
  }).catch((err) => console.error('Background process-queue failed:', err));
}

export async function bulkRejectItems(
  supabase: Supabase,
  ids: string[],
  reason: string,
  reviewedBy: string | null,
  rejectedCode: number,
): Promise<BulkResult> {
  const { data: items } = await supabase
    .from('ingestion_queue')
    .select('id, payload')
    .in('id', ids);
  if (!items) return { success: false, error: 'Failed to fetch items' };

  for (const item of items) {
    await updateQueueItem(supabase, item.id, {
      status_code: rejectedCode,
      payload: { ...item.payload, rejection_reason: reason },
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
    });
  }

  return { success: true, count: ids.length };
}

export async function bulkApproveItems(
  supabase: Supabase,
  ids: string[],
  reviewedBy: string | null,
  publishedCode: number,
): Promise<BulkResult> {
  const { data: items } = await supabase
    .from('ingestion_queue')
    .select('id, url, payload')
    .in('id', ids);
  if (!items) return { success: false, error: 'Failed to fetch items' };

  for (const item of items) {
    const result = await approveOneItem(supabase, item, reviewedBy, publishedCode);
    if (!result.success) return result;
  }

  return { success: true, count: ids.length };
}

async function approveOneItem(
  supabase: Supabase,
  item: { id: string; url: string; payload: unknown },
  reviewedBy: string | null,
  publishedCode: number,
): Promise<{ success: true } | { success: false; error: string }> {
  const payload = coercePayload(item.payload);
  const title = (payload.title as string) || 'Untitled';

  const pubData = preparePublicationData({ url: item.url, payload }, title);
  const pubResult = await upsertPublication(supabase, pubData);
  if (!pubResult.success) return { success: false, error: pubResult.error };

  const taxonomyResult = await insertTaxonomyTags(supabase, pubResult.publicationId, payload);
  if (!taxonomyResult.success) return { success: false, error: taxonomyResult.error };

  await updateQueueItem(supabase, item.id, {
    status_code: publishedCode,
    reviewed_by: reviewedBy,
    reviewed_at: new Date().toISOString(),
  });

  return { success: true };
}

export async function bulkReenrichItems(
  supabase: Supabase,
  ids: string[],
  userId: string | null,
  statusCodes: StatusCodes,
) {
  for (const queueId of ids) {
    await cancelRunningPipeline(supabase, queueId);
    const newRunId = await createPipelineRun(supabase, queueId, userId);

    await updateQueueItem(supabase, queueId, {
      status_code: statusCodes.pending_enrichment,
      current_run_id: newRunId,
      failure_count: 0,
      last_failed_step: null,
    });
  }

  await triggerAgentApiQueue();
  return { success: true as const, queued: ids.length };
}
