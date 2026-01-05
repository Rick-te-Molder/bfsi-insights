import { createServiceRoleClient } from '@/lib/supabase/server';
import { coercePayload, updateQueueItem } from './actions-queue';
import {
  insertTaxonomyTags,
  preparePublicationData,
  upsertPublication,
} from './publication-helpers';

type Supabase = ReturnType<typeof createServiceRoleClient>;

type QueueRow = {
  id: string;
  url: string;
  payload: unknown;
};

type ApproveResult = { success: true; publicationId: string } | { success: false; error: string };

type ApproveArgs = {
  supabase: Supabase;
  queueId: string;
  editedTitle?: string;
  publishedCode: number;
  reviewedBy: string | null;
};

async function fetchQueueRow(supabase: Supabase, queueId: string) {
  return supabase.from('ingestion_queue').select('id, url, payload').eq('id', queueId).single();
}

function computeTitle(payload: Record<string, unknown>, editedTitle?: string) {
  return editedTitle?.trim() || (payload.title as string) || 'Untitled';
}

async function publishAndTag(
  supabase: Supabase,
  row: QueueRow,
  payload: Record<string, unknown>,
  title: string,
) {
  const pubData = preparePublicationData({ url: row.url, payload }, title);
  const pubResult = await upsertPublication(supabase, pubData);
  if (!pubResult.success) return pubResult;

  const taxonomyResult = await insertTaxonomyTags(supabase, pubResult.publicationId, payload);
  if (!taxonomyResult.success) return taxonomyResult;

  return pubResult;
}

async function markQueueItemPublished(opts: {
  supabase: Supabase;
  row: QueueRow;
  publishedCode: number;
  reviewedBy: string | null;
  payload: Record<string, unknown>;
}) {
  return updateQueueItem(opts.supabase, opts.row.id, {
    status_code: opts.publishedCode,
    payload: opts.payload,
    reviewed_by: opts.reviewedBy,
    reviewed_at: new Date().toISOString(),
  });
}

async function approveQueueItemImpl(args: ApproveArgs): Promise<ApproveResult> {
  const { data: item, error: fetchError } = await fetchQueueRow(args.supabase, args.queueId);
  if (fetchError || !item)
    return { success: false, error: fetchError?.message || 'Failed to fetch item' };

  const row = item as QueueRow;
  const payload = coercePayload(row.payload);
  const title = computeTitle(payload, args.editedTitle);

  const pubResult = await publishAndTag(args.supabase, row, payload, title);
  if (!pubResult.success) return { success: false, error: pubResult.error };

  const updatedPayload = args.editedTitle?.trim() ? { ...payload, title } : payload;
  const { error: updateError } = await markQueueItemPublished({
    supabase: args.supabase,
    row,
    publishedCode: args.publishedCode,
    reviewedBy: args.reviewedBy,
    payload: updatedPayload,
  });
  if (updateError) return { success: false, error: updateError.message };
  return { success: true, publicationId: pubResult.publicationId };
}

export async function approveQueueItem(args: ApproveArgs): Promise<ApproveResult> {
  return approveQueueItemImpl(args);
}
