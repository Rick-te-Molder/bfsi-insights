import { useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { QueueItem } from '@bfsi/types';
import { goBackToItems } from './navigation';
import { rejectQueueItem } from './reject-update';

export function useRejectAction(args: {
  item: QueueItem;
  supabase: SupabaseClient;
  router: AppRouterInstance;
  rejectedCode: number | null;
  setLoading: (v: string | null) => void;
}) {
  return useCallback(async () => {
    try {
      if (!args.rejectedCode) throw new Error('Status codes not loaded');
      const reason = prompt('Rejection reason (optional):');
      args.setLoading('reject');

      await rejectQueueItem({
        supabase: args.supabase,
        item: args.item,
        rejectedCode: args.rejectedCode,
        reason: reason || 'Manually rejected',
      });
      goBackToItems(args.router);
    } catch (e) {
      alert(`Failed to reject: ${e instanceof Error ? e.message : 'Unknown error'}`);
      args.setLoading(null);
    }
  }, [args]);
}
