'use client';

import type { QueueItem } from '@bfsi/types';
import { ReviewActionsView } from './ReviewActionsView';
import { useReviewActionsController } from './useReviewActionsController';

export function ReviewActions({ item }: { item: QueueItem }) {
  const c = useReviewActionsController(item);

  return (
    <ReviewActionsView
      isEditable={c.flags.isEditable}
      canEditPublishedDate={c.flags.canEditPublishedDate}
      title={c.state.title}
      setTitle={c.state.setTitle}
      publishedDate={c.date.publishedDate}
      setPublishedDate={c.date.setPublishedDate}
      loading={c.state.loading}
      onUpdatePublishedDate={c.callbacks.onUpdatePublishedDate}
      showMoveToReview={c.flags.showMoveToReview}
      onMoveToReview={c.callbacks.onMoveToReview}
      showApproveReject={c.flags.showApproveReject}
      onApprove={c.callbacks.onApprove}
      onReject={c.callbacks.onReject}
      showReenrich={c.flags.showReenrich}
      onReenrich={c.callbacks.onReenrich}
      showApprovedNote={c.flags.showApprovedNote}
      itemId={c.item.id}
    />
  );
}
