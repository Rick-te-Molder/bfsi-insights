import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { QueueItem } from '@bfsi/types';
import { usePublishedDateState } from './usePublishedDateState';
import { useReviewActionsFlags } from './useReviewActionsFlags';
import { useReviewActionsState } from './useReviewActionsState';
import { useReviewStatusCodes } from './useReviewStatusCodes';
import { usePrimaryReviewCallbacks } from './usePrimaryReviewCallbacks';
import { useSecondaryReviewCallbacks } from './useSecondaryReviewCallbacks';

export function useReviewActionsController(item: QueueItem) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const state = useReviewActionsState(item);
  const date = usePublishedDateState(item.payload?.published_at);
  const codes = useReviewStatusCodes();
  const flags = useReviewActionsFlags(item, codes);

  const primary = usePrimaryReviewCallbacks({
    item,
    router,
    title: state.title,
    publishedDate: date.publishedDate,
    setLoading: state.setLoading,
  });

  const secondary = useSecondaryReviewCallbacks({
    item,
    router,
    supabase,
    setLoading: state.setLoading,
    codes,
  });

  const callbacks = { ...primary, ...secondary };

  return { item, codes, state, date, flags, callbacks };
}
