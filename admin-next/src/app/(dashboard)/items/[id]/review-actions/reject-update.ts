import type { SupabaseClient } from '@supabase/supabase-js';
import type { QueueItem } from '@bfsi/types';
import { HUMAN_REJECTED_REVIEWER_ID } from './reviewer';

export async function rejectQueueItem(args: {
  supabase: SupabaseClient;
  item: QueueItem;
  rejectedCode: number;
  reason: string;
}) {
  const { error } = await args.supabase
    .from('ingestion_queue')
    .update({
      status_code: args.rejectedCode,
      reviewer: HUMAN_REJECTED_REVIEWER_ID,
      reviewed_at: new Date().toISOString(),
      payload: {
        ...args.item.payload,
        rejection_reason: args.reason,
      },
    })
    .eq('id', args.item.id);

  if (error) throw error;
}
