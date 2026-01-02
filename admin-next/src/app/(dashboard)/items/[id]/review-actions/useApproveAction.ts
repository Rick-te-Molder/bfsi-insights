import { useCallback } from 'react';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { QueueItem } from '@bfsi/types';
import { approveQueueItemAction } from '../../actions';
import { goBackToItems } from './navigation';

export function useApproveAction(args: {
  item: QueueItem;
  title: string;
  router: AppRouterInstance;
  setLoading: (v: string | null) => void;
}) {
  return useCallback(async () => {
    try {
      if (!args.title.trim()) throw new Error('Title is required');
      args.setLoading('approve');

      const result = await approveQueueItemAction(args.item.id, args.title);
      if (!result.success) throw new Error(result.error);

      goBackToItems(args.router);
    } catch (e) {
      alert(`Failed to approve: ${e instanceof Error ? e.message : 'Unknown error'}`);
      args.setLoading(null);
    }
  }, [args]);
}
