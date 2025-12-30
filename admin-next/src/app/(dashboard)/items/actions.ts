'use server';

import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import {
  upsertPublication,
  insertTaxonomyTags,
  preparePublicationData,
} from './lib/publication-helpers';

export async function updatePublishedDateAction(itemId: string, publishedDate: string) {
  const supabase = createServiceRoleClient();

  // Fetch current payload
  const { data: currentItem, error: fetchError } = await supabase
    .from('ingestion_queue')
    .select('payload')
    .eq('id', itemId)
    .single();

  if (fetchError || !currentItem) {
    return { success: false as const, error: fetchError?.message || 'Failed to fetch item' };
  }

  const currentPayload = (currentItem.payload || {}) as Record<string, unknown>;
  const updatedPayload = {
    ...currentPayload,
    published_at: publishedDate,
  };

  // Update with service role to bypass RLS
  const { error: updateError } = await supabase
    .from('ingestion_queue')
    .update({
      payload: updatedPayload,
    })
    .eq('id', itemId);

  if (updateError) {
    return { success: false as const, error: updateError.message };
  }

  revalidatePath(`/items/${itemId}`);
  return { success: true as const };
}

export async function moveToReviewAction(itemId: string) {
  const supabase = createServiceRoleClient();

  // Fetch item to validate enrichment is complete
  const { data: item, error: fetchError } = await supabase
    .from('ingestion_queue')
    .select('payload, status_code')
    .eq('id', itemId)
    .single();

  if (fetchError || !item) {
    return { success: false as const, error: fetchError?.message || 'Failed to fetch item' };
  }

  const payload = item.payload || {};

  // Validate that tagging has been completed
  const hasAudiences = payload.audience_scores && Object.keys(payload.audience_scores).length > 0;
  const hasGeographies =
    Array.isArray(payload.geography_codes) && payload.geography_codes.length > 0;
  const hasIndustries = Array.isArray(payload.industry_codes) && payload.industry_codes.length > 0;
  const hasTopics = Array.isArray(payload.topic_codes) && payload.topic_codes.length > 0;

  const hasAnyTags = hasAudiences || hasGeographies || hasIndustries || hasTopics;

  if (!hasAnyTags) {
    return {
      success: false as const,
      error:
        'Item has not been tagged yet. Please run enrichment first or move to status 220 (to_tag) instead.',
    };
  }

  // Update status to PENDING_REVIEW (300) with service role to bypass RLS
  const { error } = await supabase
    .from('ingestion_queue')
    .update({ status_code: 300 })
    .eq('id', itemId);

  if (error) {
    return { success: false as const, error: error.message };
  }

  revalidatePath(`/items/${itemId}`);
  return { success: true as const };
}

// Get current user ID from session
async function getCurrentUserId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export async function approveQueueItemAction(queueId: string, editedTitle?: string) {
  const supabase = createServiceRoleClient();

  const { data: item, error: fetchError } = await supabase
    .from('ingestion_queue')
    .select('id, url, payload')
    .eq('id', queueId)
    .single();

  if (fetchError || !item) {
    return { success: false as const, error: fetchError?.message || 'Failed to fetch item' };
  }

  const payload = (item.payload || {}) as Record<string, unknown>;
  const title = editedTitle?.trim() || (payload.title as string) || 'Untitled';

  const pubData = preparePublicationData(item, title);
  const pubResult = await upsertPublication(supabase, pubData);

  if (!pubResult.success) {
    return { success: false as const, error: pubResult.error };
  }

  const { publicationId } = pubResult;

  const taxonomyResult = await insertTaxonomyTags(supabase, publicationId, payload);
  if (!taxonomyResult.success) {
    return { success: false as const, error: taxonomyResult.error };
  }

  // Update queue item status & persist edited title back into payload
  const newPayload = editedTitle?.trim() ? { ...payload, title } : payload;
  const reviewedBy = await getCurrentUserId();
  const { error: updateError } = await supabase
    .from('ingestion_queue')
    .update({
      status_code: 400,
      payload: newPayload,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', item.id);

  if (updateError) {
    return { success: false as const, error: updateError.message };
  }

  revalidatePath('/items');
  revalidatePath('/published');
  return { success: true as const, publicationId };
}

export async function bulkReenrichAction(
  ids: string[],
): Promise<{ success: true; queued: number } | { success: false; error: string }> {
  try {
    const supabase = createServiceRoleClient();
    const userId = await getCurrentUserId();

    // For each item, cancel old run and create new one
    for (const queueId of ids) {
      // Cancel any running pipeline_run for this item
      await supabase
        .from('pipeline_run')
        .update({ status: 'cancelled', completed_at: new Date().toISOString() })
        .eq('queue_id', queueId)
        .eq('status', 'running');

      // Create new pipeline_run with trigger='re-enrich'
      const { data: newRun } = await supabase
        .from('pipeline_run')
        .insert({
          queue_id: queueId,
          trigger: 're-enrich',
          status: 'running',
          created_by: userId || 'system',
        })
        .select('id')
        .single();

      // Update ingestion_queue with new current_run_id and reset status
      // Also reset failure tracking for DLQ items (KB-268)
      await supabase
        .from('ingestion_queue')
        .update({
          status_code: 200, // 200 = PENDING_ENRICHMENT
          current_run_id: newRun?.id || null,
          failure_count: 0,
          last_failed_step: null,
        })
        .eq('id', queueId);
    }

    // Note: We don't check for errors on pipeline_run operations
    // because the table might not exist in older environments

    // Trigger processing
    const agentApiUrl = process.env.AGENT_API_URL || 'https://bfsi-insights.onrender.com';
    const agentApiKey = process.env.AGENT_API_KEY;

    // Trigger processing in background (don't await - let items move to "Queued" immediately)
    if (agentApiKey) {
      fetch(`${agentApiUrl}/api/agents/process-queue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': agentApiKey,
        },
        body: JSON.stringify({ limit: 20, includeThumbnail: true }),
      }).catch((err) => console.error('Background process-queue failed:', err));
    }

    revalidatePath('/items');
    return { success: true, queued: ids.length };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function bulkRejectAction(ids: string[], reason: string) {
  const supabase = createServiceRoleClient();

  // Get current items to preserve payload
  const { data: items } = await supabase
    .from('ingestion_queue')
    .select('id, payload')
    .in('id', ids);

  if (!items) {
    return { success: false, error: 'Failed to fetch items' };
  }

  // Update each with rejection reason in payload
  const reviewedBy = await getCurrentUserId();
  for (const item of items) {
    await supabase
      .from('ingestion_queue')
      .update({
        status_code: 540, // 540 = REJECTED
        payload: { ...item.payload, rejection_reason: reason },
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', item.id);
  }

  revalidatePath('/items');
  return { success: true, count: ids.length };
}

export async function bulkApproveAction(ids: string[]) {
  const supabase = createServiceRoleClient();

  // Get items with payload
  const { data: items } = await supabase
    .from('ingestion_queue')
    .select('id, url, payload')
    .in('id', ids);

  if (!items) {
    return { success: false, error: 'Failed to fetch items' };
  }

  for (const item of items) {
    const payload = (item.payload || {}) as Record<string, unknown>;
    const title = (payload.title as string) || 'Untitled';

    const pubData = preparePublicationData(item, title);
    const pubResult = await upsertPublication(supabase, pubData);

    if (!pubResult.success) {
      console.error('Failed to upsert publication:', pubResult.error);
      return { success: false, error: pubResult.error };
    }

    const { publicationId } = pubResult;

    const taxonomyResult = await insertTaxonomyTags(supabase, publicationId, payload);
    if (!taxonomyResult.success) {
      console.error('Failed to insert taxonomy tags:', taxonomyResult.error);
      return { success: false, error: taxonomyResult.error };
    }

    const reviewedBy = await getCurrentUserId();
    await supabase
      .from('ingestion_queue')
      .update({
        status_code: 400,
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', item.id);
  }

  revalidatePath('/items');
  revalidatePath('/published');
  return { success: true, count: ids.length };
}

export async function deleteItemAction(id: string) {
  const supabase = createServiceRoleClient();

  const { error } = await supabase.from('ingestion_queue').delete().eq('id', id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/items');
  return { success: true };
}
