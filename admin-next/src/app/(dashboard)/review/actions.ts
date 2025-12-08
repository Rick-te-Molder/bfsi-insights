'use server';

import { createServiceRoleClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function bulkReenrichAction(ids: string[]) {
  const supabase = createServiceRoleClient();

  const { error } = await supabase
    .from('ingestion_queue')
    .update({ status: 'queued' })
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

export async function deleteItemAction(id: string) {
  const supabase = createServiceRoleClient();

  const { error } = await supabase.from('ingestion_queue').delete().eq('id', id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/review');
  return { success: true };
}
