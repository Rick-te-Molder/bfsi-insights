import { ButtonStack } from './ReviewActionsView.ButtonStack';
import { CompareLink } from './ReviewActionsView.CompareLink';
import {
  ApproveRejectButtons,
  ApprovedNote,
  MoveToReviewButton,
  ReenrichButton,
} from './ReviewActionsView.ActionButtons';

export function ActionsBlock(props: {
  loading: string | null;
  showMoveToReview: boolean;
  onMoveToReview: () => void;
  showApproveReject: boolean;
  onApprove: () => void;
  onReject: () => void;
  showReenrich: boolean;
  onReenrich: () => void;
  showApprovedNote: boolean;
  itemId: string;
}) {
  return (
    <ButtonStack>
      {props.showMoveToReview && (
        <MoveToReviewButton loading={props.loading} onClick={props.onMoveToReview} />
      )}
      {props.showApproveReject && (
        <ApproveRejectButtons
          loading={props.loading}
          onApprove={props.onApprove}
          onReject={props.onReject}
        />
      )}
      {props.showReenrich && <ReenrichButton loading={props.loading} onClick={props.onReenrich} />}
      {props.showApprovedNote && <ApprovedNote />}
      <CompareLink itemId={props.itemId} />
    </ButtonStack>
  );
}
