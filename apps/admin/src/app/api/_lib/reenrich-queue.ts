import { createServiceRoleClient } from '@/lib/supabase/server';

type PublicationRow = {
  id: string;
  origin_queue_id: string | null;
  source_url: string;
  title: string;
  published_at: string | null;
};

export type QueueItemRow = { payload: Record<string, unknown>; status_code: number };

async function fetchQueueItem(supabase: ReturnType<typeof createServiceRoleClient>, id: string) {
  const result = await supabase
    .from('ingestion_queue')
    .select('payload, status_code')
    .eq('id', id)
    .single<QueueItemRow>();

  if (result.error && result.error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch queue item ${id}: ${result.error.message}`);
  }

  return result;
}

function normalizeQueueUrl(url: string) {
  return url.toLowerCase().replace(/[?#].*$/, '');
}

async function fetchQueueIdByUrlNorm(
  supabase: ReturnType<typeof createServiceRoleClient>,
  urlNorm: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('ingestion_queue')
    .select('id')
    .eq('url_norm', urlNorm)
    .maybeSingle<{ id: string }>();

  if (error) {
    throw new Error(`Failed to fetch queue item by url_norm: ${error.message}`);
  }

  return data?.id ?? null;
}

async function fetchPublicationForReenrich(
  supabase: ReturnType<typeof createServiceRoleClient>,
  id: string,
) {
  return supabase
    .from('kb_publication')
    .select('id, origin_queue_id, source_url, title, published_at')
    .eq('id', id)
    .single<PublicationRow>();
}

export async function getStatusCode(
  supabase: ReturnType<typeof createServiceRoleClient>,
  name: string,
): Promise<number> {
  const { data } = await supabase.from('status_lookup').select('code').eq('name', name).single();
  if (!data) throw new Error(`Status code not found: ${name}`);
  return data.code;
}

async function getExistingQueueIdIfPresent(
  supabase: ReturnType<typeof createServiceRoleClient>,
  originQueueId: string | null,
): Promise<string | null> {
  if (!originQueueId) return null;
  const existing = await fetchQueueItem(supabase, originQueueId);
  return existing.data ? originQueueId : null;
}

async function loadReenrichStatusCodes(supabase: ReturnType<typeof createServiceRoleClient>) {
  const pendingReviewCode = await getStatusCode(supabase, 'pending_review');
  const pendingEnrichmentCode = await getStatusCode(supabase, 'pending_enrichment');
  return { pendingReviewCode, pendingEnrichmentCode };
}

function buildReenrichQueuePayload(publication: PublicationRow, pendingReviewCode: number) {
  return {
    title: publication.title,
    published_at: publication.published_at,
    _manual_override: true,
    _return_status: pendingReviewCode,
  };
}

async function insertQueueItemForPublication(
  supabase: ReturnType<typeof createServiceRoleClient>,
  input: {
    queueId: string | null;
    sourceUrl: string;
    payload: Record<string, unknown>;
    statusCode: number;
  },
): Promise<string> {
  const insert = await supabase
    .from('ingestion_queue')
    .insert({
      ...(input.queueId ? { id: input.queueId } : {}),
      url: input.sourceUrl,
      payload: input.payload,
      status_code: input.statusCode,
    })
    .select('id')
    .single();

  if (insert.error) {
    const isUniqueViolation = insert.error.code === '23505';
    const isUrlNormConstraint = insert.error.message.includes('idx_queue_url_norm');
    if (isUniqueViolation && isUrlNormConstraint) {
      const existingId = await fetchQueueIdByUrlNorm(supabase, normalizeQueueUrl(input.sourceUrl));
      if (existingId) return existingId;
    }

    throw new Error(insert.error.message || 'Failed to create queue item for publication');
  }

  if (!insert.data) {
    throw new Error('Failed to create queue item for publication');
  }

  return insert.data.id;
}

async function setPublicationOriginQueueId(
  supabase: ReturnType<typeof createServiceRoleClient>,
  publicationId: string,
  originQueueId: string,
) {
  await supabase
    .from('kb_publication')
    .update({ origin_queue_id: originQueueId })
    .eq('id', publicationId);
}

async function ensureQueueItemForPublication(
  supabase: ReturnType<typeof createServiceRoleClient>,
  publication: PublicationRow,
): Promise<string> {
  const existingId = await getExistingQueueIdIfPresent(supabase, publication.origin_queue_id);
  if (existingId) return existingId;

  const { pendingReviewCode, pendingEnrichmentCode } = await loadReenrichStatusCodes(supabase);
  const payload = buildReenrichQueuePayload(publication, pendingReviewCode);
  const createdId = await insertQueueItemForPublication(supabase, {
    queueId: publication.origin_queue_id,
    sourceUrl: publication.source_url,
    payload,
    statusCode: pendingEnrichmentCode,
  });

  if (!publication.origin_queue_id) {
    await setPublicationOriginQueueId(supabase, publication.id, createdId);
  }

  return createdId;
}

export async function resolveQueueItemForEnrichment(
  supabase: ReturnType<typeof createServiceRoleClient>,
  id: string,
): Promise<{ queueId: string | null; item: QueueItemRow | null }> {
  const direct = await fetchQueueItem(supabase, id);
  if (direct.data) return { queueId: id, item: direct.data };

  const pub = await fetchPublicationForReenrich(supabase, id);
  if (pub.error || !pub.data) return { queueId: null, item: null };

  const queueId = await ensureQueueItemForPublication(supabase, pub.data);
  const q = await fetchQueueItem(supabase, queueId);

  return { queueId, item: q.data ?? null };
}

export async function resolveQueueIdForEnrichment(
  supabase: ReturnType<typeof createServiceRoleClient>,
  id: string,
): Promise<string | null> {
  const resolved = await resolveQueueItemForEnrichment(supabase, id);
  return resolved.queueId;
}

function buildReenrichOverridePayload(
  basePayload: Record<string, unknown>,
  pendingReviewCode: number,
): Record<string, unknown> {
  return {
    ...basePayload,
    _manual_override: true,
    _return_status: pendingReviewCode,
  };
}

async function fetchCurrentPayload(
  supabase: ReturnType<typeof createServiceRoleClient>,
  queueId: string,
): Promise<Record<string, unknown>> {
  const { data } = await supabase
    .from('ingestion_queue')
    .select('payload')
    .eq('id', queueId)
    .single<{ payload: Record<string, unknown> }>();
  return data?.payload ?? {};
}

async function setManualOverridePayload(
  supabase: ReturnType<typeof createServiceRoleClient>,
  queueId: string,
  pendingReviewCode: number,
): Promise<void> {
  const basePayload = await fetchCurrentPayload(supabase, queueId);
  const updatedPayload = buildReenrichOverridePayload(basePayload, pendingReviewCode);

  await supabase.from('ingestion_queue').update({ payload: updatedPayload }).eq('id', queueId);
}

/**
 * Prepare a queue item for full re-enrichment.
 * Sets _manual_override:true and _return_status so orchestrator can transition directly.
 * Does NOT change status - orchestrator handles the final transition (e.g., 400→300).
 */
export async function prepareQueueForFullReenrich(
  supabase: ReturnType<typeof createServiceRoleClient>,
  queueId: string,
): Promise<void> {
  const { pendingReviewCode } = await loadReenrichStatusCodes(supabase);
  await setManualOverridePayload(supabase, queueId, pendingReviewCode);
  // No status transition here - orchestrator will transition directly to pendingReviewCode
}
