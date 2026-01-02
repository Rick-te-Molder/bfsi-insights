import type { SupabaseClient } from '@supabase/supabase-js';
import type { QueueItem } from '@bfsi/types';

export async function cancelRunningPipeline(supabase: SupabaseClient, queueId: string) {
  await supabase
    .from('pipeline_run')
    .update({ status: 'cancelled', completed_at: new Date().toISOString() })
    .eq('queue_id', queueId)
    .eq('status', 'running');
}

export async function createReenrichRun(supabase: SupabaseClient, queueId: string) {
  const { data } = await supabase
    .from('pipeline_run')
    .insert({ queue_id: queueId, trigger: 're-enrich', status: 'running', created_by: 'system' })
    .select('id')
    .single();

  return data?.id ?? null;
}

export async function updateQueueForReenrich(args: {
  supabase: SupabaseClient;
  item: QueueItem;
  pendingEnrichmentCode: number;
  runId: string | null;
}) {
  const { error } = await args.supabase
    .from('ingestion_queue')
    .update({ status_code: args.pendingEnrichmentCode, current_run_id: args.runId })
    .eq('id', args.item.id);

  if (error) throw error;
}
