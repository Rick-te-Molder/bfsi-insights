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

  if (agentApiKey) {
    try {
      const res = await fetch(`${agentApiUrl}/api/agents/process-queue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': agentApiKey,
        },
        body: JSON.stringify({ limit: 20, includeThumbnail: true }),
      });
      const data = await res.json();
      revalidatePath('/review');
      return { success: true, processed: data.processed || ids.length };
    } catch {
      revalidatePath('/review');
      return { success: true, processed: 0, warning: 'Queued but processing failed' };
    }
  }

  revalidatePath('/review');
  return { success: true, processed: ids.length };
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

    const { error: pubError } = await supabase.from('kb_publication').insert({
      slug: `${slug}-${Date.now()}`,
      title,
      source_url: item.url,
      source_slug: payload.source_slug || 'manual',
      published_at: new Date().toISOString(),
      summary_short: summary.short || '',
      summary_medium: summary.medium || '',
      summary_long: summary.long || '',
    });

    if (pubError) {
      console.error('Failed to insert publication:', pubError);
      return { success: false, error: `Failed to publish: ${pubError.message}` };
    }

    await supabase.from('ingestion_queue').update({ status: 'approved' }).eq('id', item.id);
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
