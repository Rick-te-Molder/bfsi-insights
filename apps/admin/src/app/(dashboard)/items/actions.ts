'use server';

import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getStatusCode, getStatusCodes } from './lib/actions-status';
import { coercePayload, fetchQueueItem, mergePayload, updateQueueItem } from './lib/actions-queue';
import { bulkApproveItems, bulkReenrichItems, bulkRejectItems } from './lib/actions-bulk';
import { hasAnyTaxonomyTags } from './lib/actions-validate';
import { approveQueueItem } from './lib/actions-approve';

function normalizePublishedDate(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}$/.test(raw)) return `${raw}-01`;

  const dmY = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (dmY) {
    const day = Number(dmY[1]);
    const month = Number(dmY[2]);
    const yearPart = dmY[3];
    const year = yearPart.length === 2 ? 2000 + Number(yearPart) : Number(yearPart);

    if (day < 1 || day > 31 || month < 1 || month > 12) return null;

    const yyyy = String(year).padStart(4, '0');
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().split('T')[0];
}

export async function updatePublishedDateAction(itemId: string, publishedDate: string) {
  const supabase = createServiceRoleClient();

  const { data: currentItem, error: fetchError } = await fetchQueueItem(
    supabase,
    itemId,
    'payload',
  );
  if (fetchError || !currentItem)
    return { success: false as const, error: fetchError?.message || 'Failed to fetch item' };

  const currentPayload = coercePayload(currentItem.payload);
  const normalized = normalizePublishedDate(publishedDate);
  if (!normalized) return { success: false as const, error: 'Invalid publication date format' };

  const updatedPayload = mergePayload(currentPayload, { published_at: normalized });
  const { error: updateError } = await updateQueueItem(supabase, itemId, {
    payload: updatedPayload,
  });
  if (updateError) return { success: false as const, error: updateError.message };

  revalidatePath(`/items/${itemId}`);
  return { success: true as const };
}

export async function moveToReviewAction(itemId: string) {
  const supabase = createServiceRoleClient();

  const { data: item, error: fetchError } = await fetchQueueItem(
    supabase,
    itemId,
    'payload, status_code',
  );
  if (fetchError || !item)
    return { success: false as const, error: fetchError?.message || 'Failed to fetch item' };

  const payload = coercePayload(item.payload);
  if (!hasAnyTaxonomyTags(payload)) {
    return {
      success: false as const,
      error:
        'Item has not been tagged yet. Please run enrichment first or move to "to_tag" instead.',
    };
  }

  const pendingReviewCode = await getStatusCode(supabase, 'pending_review');
  const { error } = await updateQueueItem(supabase, itemId, { status_code: pendingReviewCode });
  if (error) return { success: false as const, error: error.message };

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

  const publishedCode = await getStatusCode(supabase, 'published');
  const reviewedBy = await getCurrentUserId();

  const result = await approveQueueItem({
    supabase,
    queueId,
    editedTitle,
    publishedCode,
    reviewedBy,
  });
  if (!result.success) return { success: false as const, error: result.error };

  revalidatePath('/items');
  revalidatePath('/published');
  return { success: true as const, publicationId: result.publicationId };
}

export async function bulkReenrichAction(
  ids: string[],
): Promise<{ success: true; queued: number } | { success: false; error: string }> {
  try {
    const supabase = createServiceRoleClient();
    const userId = await getCurrentUserId();

    const codes = await getStatusCodes(supabase, ['pending_enrichment', 'published', 'rejected']);
    await bulkReenrichItems(supabase, ids, userId, {
      pending_enrichment: codes.pending_enrichment,
      published: codes.published,
      rejected: codes.rejected,
    });

    revalidatePath('/items');
    return { success: true, queued: ids.length };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function bulkRejectAction(ids: string[], reason: string) {
  const supabase = createServiceRoleClient();

  const reviewedBy = await getCurrentUserId();
  const rejectedCode = await getStatusCode(supabase, 'rejected');
  const result = await bulkRejectItems(supabase, ids, reason, reviewedBy, rejectedCode);
  if (!result.success) return result;

  revalidatePath('/items');
  return { success: true, count: ids.length };
}

export async function bulkApproveAction(ids: string[]) {
  const supabase = createServiceRoleClient();

  const reviewedBy = await getCurrentUserId();
  const publishedCode = await getStatusCode(supabase, 'published');
  const result = await bulkApproveItems(supabase, ids, reviewedBy, publishedCode);
  if (!result.success) return result;

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
