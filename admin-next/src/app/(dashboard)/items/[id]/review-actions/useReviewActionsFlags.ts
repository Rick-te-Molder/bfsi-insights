import type { QueueItem } from '@bfsi/types';
import type { ReviewActionCodes } from './review-flags';
import { canEditPublishedDate, isEditableStatus, shouldShowReenrich } from './review-flags';

export function useReviewActionsFlags(item: QueueItem, codes: ReviewActionCodes) {
  const isEditable = isEditableStatus(item.status_code, codes);
  const canEditDate = canEditPublishedDate(item.status_code, codes);

  return {
    isEditable,
    canEditPublishedDate: canEditDate,
    showMoveToReview: codes.enriched !== null && item.status_code === codes.enriched,
    showApproveReject: codes.pendingReview !== null && item.status_code === codes.pendingReview,
    showReenrich: shouldShowReenrich(item.status_code, codes),
    showApprovedNote: codes.approved !== null && item.status_code === codes.approved,
  };
}
