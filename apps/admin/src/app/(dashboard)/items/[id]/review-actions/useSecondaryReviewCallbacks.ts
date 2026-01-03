import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { QueueItem } from '@bfsi/types';
import type { ReviewActionCodes } from './review-flags';
import { useReenrichAction } from './useReenrichAction';
import { useRejectAction } from './useRejectAction';

export function useSecondaryReviewCallbacks(args: {
  item: QueueItem;
  router: AppRouterInstance;
  supabase: SupabaseClient;
  setLoading: (v: string | null) => void;
  codes: ReviewActionCodes;
}) {
  const onReject = useRejectAction({
    item: args.item,
    supabase: args.supabase,
    router: args.router,
    rejectedCode: args.codes.rejected,
    setLoading: args.setLoading,
  });

  const onReenrich = useReenrichAction({
    item: args.item,
    supabase: args.supabase,
    router: args.router,
    pendingEnrichmentCode: args.codes.pendingEnrichment,
    setLoading: args.setLoading,
  });

  return { onReject, onReenrich };
}
