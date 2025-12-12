'use server';

import { createServiceRoleClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function bulkReenrichAction(ids: string[]) {
  const supabase = createServiceRoleClient();

  const { error } = await supabase
    .from('ingestion_queue')
    .update({ status: 'queued', status_code: 200 }) // 200 = PENDING_ENRICHMENT
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
        status: 'rejected',
        status_code: 540, // 540 = REJECTED
        payload: { ...item.payload, rejection_reason: reason },
      })
      .eq('id', item.id);
  }

  revalidatePath('/review');
  return { success: true, count: ids.length };
}

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

    // Insert publication
    const { data: pubData, error: pubError } = await supabase
      .from('kb_publication')
      .insert({
        slug: `${slug}-${Date.now()}`,
        title,
        source_url: item.url,
        source_name:
          payload.source_slug && payload.source_slug !== 'manual'
            ? payload.source_slug
            : sourceDomain,
        source_domain: sourceDomain,
        date_published: payload.published_at || new Date().toISOString(),
        summary_short: summary.short || '',
        summary_medium: summary.medium || '',
        summary_long: summary.long || '',
        thumbnail: payload.thumbnail_url || null,
        status: 'published',
      })
      .select('id')
      .single();

    if (pubError || !pubData) {
      console.error('Failed to insert publication:', pubError);
      return { success: false, error: `Failed to publish: ${pubError?.message}` };
    }

    const publicationId = pubData.id;

    // Insert industry tags
    if (payload.industry_codes?.length) {
      await supabase.from('kb_publication_bfsi_industry').insert(
        payload.industry_codes.map((code: string) => ({
          publication_id: publicationId,
          industry_code: code,
        })),
      );
    }

    // Insert topic tags
    if (payload.topic_codes?.length) {
      await supabase.from('kb_publication_bfsi_topic').insert(
        payload.topic_codes.map((code: string) => ({
          publication_id: publicationId,
          topic_code: code,
        })),
      );
    }

    await supabase
      .from('ingestion_queue')
      .update({ status: 'approved', status_code: 330 })
      .eq('id', item.id);
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
