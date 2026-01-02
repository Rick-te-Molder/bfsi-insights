export type ReviewActionCodes = {
  enriched: number | null;
  pendingReview: number | null;
  approved: number | null;
  failed: number | null;
  rejected: number | null;
  pendingEnrichment: number | null;
};

function present(codes: Array<number | null>): number[] {
  return codes.filter((x): x is number => typeof x === 'number');
}

export function isEditableStatus(statusCode: number, codes: ReviewActionCodes) {
  return present([codes.pendingReview, codes.failed, codes.rejected]).includes(statusCode);
}

export function canEditPublishedDate(statusCode: number, codes: ReviewActionCodes) {
  return present([codes.enriched, codes.pendingReview, codes.failed, codes.rejected]).includes(
    statusCode,
  );
}

export function shouldShowReenrich(statusCode: number, codes: ReviewActionCodes) {
  return present([codes.pendingReview, codes.failed, codes.rejected]).includes(statusCode);
}
