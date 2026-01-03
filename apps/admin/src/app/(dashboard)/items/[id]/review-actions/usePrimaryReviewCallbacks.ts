import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { QueueItem } from '@bfsi/types';
import { useApproveAction } from './useApproveAction';
import { useMoveToReview } from './useMoveToReview';
import { useUpdatePublishedDate } from './useUpdatePublishedDate';

export function usePrimaryReviewCallbacks(args: {
  item: QueueItem;
  router: AppRouterInstance;
  title: string;
  publishedDate: string;
  setLoading: (v: string | null) => void;
}) {
  const onApprove = useApproveAction({
    item: args.item,
    title: args.title,
    router: args.router,
    setLoading: args.setLoading,
  });

  const onMoveToReview = useMoveToReview({ item: args.item, setLoading: args.setLoading });

  const onUpdatePublishedDate = useUpdatePublishedDate({
    item: args.item,
    publishedDate: args.publishedDate,
    setLoading: args.setLoading,
  });

  return { onApprove, onMoveToReview, onUpdatePublishedDate };
}
