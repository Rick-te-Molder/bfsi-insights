import { useCallback } from 'react';
import type { QueueItem } from '@bfsi/types';
import { updatePublishedDateAction } from '../../actions';
import { reloadItem } from './navigation';

export function useUpdatePublishedDate(args: {
  item: QueueItem;
  publishedDate: string;
  setLoading: (v: string | null) => void;
}) {
  return useCallback(async () => {
    try {
      if (!args.publishedDate.trim()) throw new Error('Please enter a publication date');
      args.setLoading('update-date');

      const result = await updatePublishedDateAction(args.item.id, args.publishedDate);
      if (!result.success) throw new Error(result.error);

      reloadItem(args.item.id);
    } catch (e) {
      console.error('Save date failed:', e);
      alert(`Failed to update date: ${e instanceof Error ? e.message : 'Unknown error'}`);
      args.setLoading(null);
    }
  }, [args]);
}
