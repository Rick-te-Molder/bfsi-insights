import { useCallback } from 'react';
import type { QueueItem } from '@bfsi/types';
import { moveToReviewAction } from '../../actions';
import { reloadItem } from './navigation';

export function useMoveToReview(args: { item: QueueItem; setLoading: (v: string | null) => void }) {
  return useCallback(async () => {
    try {
      args.setLoading('move-to-review');
      const result = await moveToReviewAction(args.item.id);
      if (!result.success) throw new Error(result.error);
      reloadItem(args.item.id);
    } catch (e) {
      console.error('Move to review failed:', e);
      alert(`Failed to move to review: ${e instanceof Error ? e.message : 'Unknown error'}`);
      args.setLoading(null);
    }
  }, [args]);
}
