'use server';

import { createServiceRoleClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// Extract domain from URL for source_name
function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    // Remove www. prefix
    return hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}

function buildPublicStorageUrl(bucket?: string | null, path?: string | null): string | null {
  if (!bucket || !path) return null;
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) return null;
  return `${baseUrl}/storage/v1/object/public/${bucket}/${path}`;
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
  const summary = (payload.summary || {}) as Record<string, unknown>;
  const title = editedTitle?.trim() || (payload.title as string) || 'Untitled';
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

  const sourceDomain = extractDomain(item.url);
  // Check multiple payload fields for source name (discoverer uses 'source', premium uses 'source_name'/'source_slug')
  const sourceFromPayload = (payload.source_name || payload.source || payload.source_slug) as
    | string
    | undefined;

  const thumbnailBucket = (payload.thumbnail_bucket as string | null | undefined) ?? null;
  const thumbnailPath = (payload.thumbnail_path as string | null | undefined) ?? null;
  const thumbnailUrl =
    (payload.thumbnail_url as string | null | undefined) ??
    buildPublicStorageUrl(thumbnailBucket, thumbnailPath) ??
    null;

  // Insert publication
  const { data: pubData, error: pubError } = await supabase
    .from('kb_publication')
    .insert({
      slug: `${slug}-${Date.now()}`,
      title,
      source_url: item.url,
      source_name:
        sourceFromPayload && sourceFromPayload !== 'manual' ? sourceFromPayload : sourceDomain,
      source_domain: sourceDomain,
      date_published: (payload.published_at as string) || new Date().toISOString(),
      summary_short: (summary.short as string) || '',
      summary_medium: (summary.medium as string) || '',
      summary_long: (summary.long as string) || '',
      thumbnail: thumbnailUrl,
      thumbnail_bucket: thumbnailBucket,
      thumbnail_path: thumbnailPath,
      status: 'published',
    })
    .select('id')
    .single();

  if (pubError || !pubData) {
    return { success: false as const, error: pubError?.message || 'Failed to publish' };
  }

  // Insert taxonomy tags dynamically based on taxonomy_config
  const { data: taxonomyConfigs, error: taxonomyConfigError } = await supabase
    .from('taxonomy_config')
    .select('payload_field, junction_table, junction_code_column')
    .eq('is_active', true)
    .not('junction_table', 'is', null);

  if (taxonomyConfigError) {
    return { success: false as const, error: taxonomyConfigError.message };
  }

  for (const config of taxonomyConfigs || []) {
    const key = config.payload_field as string;
    if (!config.junction_table || !config.junction_code_column) continue;

    // Handle audience_scores specially (object with scores, not array)
    if (key === 'audience_scores') {
      const scores = payload[key] as Record<string, number> | undefined;
      if (scores && typeof scores === 'object') {
        const entries = Object.entries(scores).filter(([, score]) => score > 0);
        if (entries.length > 0) {
          const { error: insertError } = await supabase.from(config.junction_table).insert(
            entries.map(([code, score]) => ({
              publication_id: pubData.id,
              [config.junction_code_column as string]: code,
              score,
            })),
          );
          if (insertError) {
            return { success: false as const, error: insertError.message };
          }
        }
      }
      continue;
    }

    // Standard array handling for other taxonomy tags
    const codes = payload[key] as string[] | undefined;
    if (!codes?.length) continue;

    const { error: insertError } = await supabase.from(config.junction_table).insert(
      codes.map((code: string) => ({
        publication_id: pubData.id,
        [config.junction_code_column as string]: code,
      })),
    );

    if (insertError) {
      return { success: false as const, error: insertError.message };
    }
  }

  // Update queue item status & persist edited title back into payload
  const newPayload = editedTitle?.trim() ? { ...payload, title } : payload;
  const { error: updateError } = await supabase
    .from('ingestion_queue')
    .update({ status_code: 330, payload: newPayload })
    .eq('id', item.id);

  if (updateError) {
    return { success: false as const, error: updateError.message };
  }

  revalidatePath('/review');
  revalidatePath('/published');
  return { success: true as const, publicationId: pubData.id };
}

export async function bulkReenrichAction(ids: string[]) {
  const supabase = createServiceRoleClient();

  const { error } = await supabase
    .from('ingestion_queue')
    .update({ status_code: 200 }) // 200 = PENDING_ENRICHMENT
    .in('id', ids);

  if (error) {
    return { success: false, error: error.message };
  }

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

  revalidatePath('/review');
  return { success: true, queued: ids.length };
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
  for (const item of items) {
    await supabase
      .from('ingestion_queue')
      .update({
        status_code: 540, // 540 = REJECTED
        payload: { ...item.payload, rejection_reason: reason },
      })
      .eq('id', item.id);
  }

  revalidatePath('/review');
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
    const payload = item.payload || {};
    const title = payload.title || 'Untitled';
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80);

    const summary = payload.summary || {};
    const sourceDomain = extractDomain(item.url);

    const thumbnailBucket = (payload.thumbnail_bucket as string | null | undefined) ?? null;
    const thumbnailPath = (payload.thumbnail_path as string | null | undefined) ?? null;
    const thumbnailUrl =
      (payload.thumbnail_url as string | null | undefined) ??
      buildPublicStorageUrl(thumbnailBucket, thumbnailPath) ??
      null;

    // Insert publication
    const { data: pubData, error: pubError } = await supabase
      .from('kb_publication')
      .insert({
        slug: `${slug}-${Date.now()}`,
        title,
        source_url: item.url,
        source_name:
          (payload.source_name || payload.source || payload.source_slug) &&
          (payload.source_name || payload.source || payload.source_slug) !== 'manual'
            ? payload.source_name || payload.source || payload.source_slug
            : sourceDomain,
        source_domain: sourceDomain,
        date_published: payload.published_at || new Date().toISOString(),
        summary_short: summary.short || '',
        summary_medium: summary.medium || '',
        summary_long: summary.long || '',
        thumbnail: thumbnailUrl,
        thumbnail_bucket: thumbnailBucket,
        thumbnail_path: thumbnailPath,
        status: 'published',
      })
      .select('id')
      .single();

    if (pubError || !pubData) {
      console.error('Failed to insert publication:', pubError);
      return { success: false, error: `Failed to publish: ${pubError?.message}` };
    }

    const publicationId = pubData.id;

    // Insert taxonomy tags dynamically based on taxonomy_config
    const { data: taxonomyConfigs } = await supabase
      .from('taxonomy_config')
      .select('payload_field, junction_table, junction_code_column')
      .eq('is_active', true)
      .not('junction_table', 'is', null);

    if (taxonomyConfigs) {
      for (const config of taxonomyConfigs) {
        const key = config.payload_field as string;
        if (!config.junction_table || !config.junction_code_column) continue;

        // Handle audience_scores specially (object with scores, not array)
        if (key === 'audience_scores') {
          const scores = payload[key] as Record<string, number> | undefined;
          if (scores && typeof scores === 'object') {
            const entries = Object.entries(scores).filter(([, score]) => score > 0);
            if (entries.length > 0) {
              await supabase.from(config.junction_table).insert(
                entries.map(([code, score]) => ({
                  publication_id: publicationId,
                  [config.junction_code_column]: code,
                  score,
                })),
              );
            }
          }
          continue;
        }

        // Standard array handling
        const codes = payload[key] as string[] | undefined;
        if (codes?.length) {
          await supabase.from(config.junction_table).insert(
            codes.map((code: string) => ({
              publication_id: publicationId,
              [config.junction_code_column]: code,
            })),
          );
        }
      }
    }

    await supabase.from('ingestion_queue').update({ status_code: 330 }).eq('id', item.id);
  }

  revalidatePath('/review');
  revalidatePath('/published');
  return { success: true, count: ids.length };
}

export async function deleteItemAction(id: string) {
  const supabase = createServiceRoleClient();

  const { error } = await supabase.from('ingestion_queue').delete().eq('id', id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/review');
  return { success: true };
}
