export type ReviewActionsViewProps = {
  isEditable: boolean;
  canEditPublishedDate: boolean;
  title: string;
  setTitle: (v: string) => void;
  publishedDate: string;
  setPublishedDate: (v: string) => void;
  loading: string | null;
  onUpdatePublishedDate: () => void;
  showMoveToReview: boolean;
  onMoveToReview: () => void;
  showApproveReject: boolean;
  onApprove: () => void;
  onReject: () => void;
  showReenrich: boolean;
  onReenrich: () => void;
  showApprovedNote: boolean;
  itemId: string;
};
