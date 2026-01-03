import { useStatusCodeByName } from './useStatusCodeByName';
import { STATUS_NAME } from './status-names';

export function useReviewStatusCodes() {
  const enriched = useStatusCodeByName(STATUS_NAME.enriched);
  const pendingReview = useStatusCodeByName(STATUS_NAME.pendingReview);
  const approved = useStatusCodeByName(STATUS_NAME.approved);
  const failed = useStatusCodeByName(STATUS_NAME.failed);
  const rejected = useStatusCodeByName(STATUS_NAME.rejected);
  const pendingEnrichment = useStatusCodeByName(STATUS_NAME.pendingEnrichment);

  return {
    enriched: enriched.code,
    pendingReview: pendingReview.code,
    approved: approved.code,
    failed: failed.code,
    rejected: rejected.code,
    pendingEnrichment: pendingEnrichment.code,
  };
}
