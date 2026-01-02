import { useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { QueueItem } from '@bfsi/types';
import { goBackToItems } from './navigation';
import {
  cancelRunningPipeline,
  createReenrichRun,
  updateQueueForReenrich,
} from './reenrich-update';

export function useReenrichAction(args: {
  item: QueueItem;
  supabase: SupabaseClient;
  router: AppRouterInstance;
  pendingEnrichmentCode: number | null;
  setLoading: (v: string | null) => void;
}) {
  return useCallback(async () => {
    try {
      if (!args.pendingEnrichmentCode) throw new Error('Status codes not loaded');
      args.setLoading('reenrich');

      await cancelRunningPipeline(args.supabase, args.item.id);
      const runId = await createReenrichRun(args.supabase, args.item.id);
      await updateQueueForReenrich({
        supabase: args.supabase,
        item: args.item,
        pendingEnrichmentCode: args.pendingEnrichmentCode,
        runId,
      });
      goBackToItems(args.router);
    } catch (e) {
      alert(
        `Failed to queue for re-enrichment: ${e instanceof Error ? e.message : 'Unknown error'}`,
      );
      args.setLoading(null);
    }
  }, [args]);
}
