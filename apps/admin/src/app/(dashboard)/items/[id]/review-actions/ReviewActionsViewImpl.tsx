import { ActionsCard, ActionsCardHeader } from './ReviewActionsView.Card';
import { ActionsBlock } from './ReviewActionsView.ActionsBlock';
import { EditorsBlock } from './ReviewActionsView.EditorsBlock';
import type { ReviewActionsViewProps } from './ReviewActionsView.types';

export function ReviewActionsView(props: Readonly<ReviewActionsViewProps>) {
  return (
    <ActionsCard>
      <ActionsCardHeader />
      <EditorsBlock
        isEditable={props.isEditable}
        canEditPublishedDate={props.canEditPublishedDate}
        title={props.title}
        setTitle={props.setTitle}
        publishedDate={props.publishedDate}
        setPublishedDate={props.setPublishedDate}
        loading={props.loading}
        onUpdatePublishedDate={props.onUpdatePublishedDate}
      />
      <ActionsBlock
        loading={props.loading}
        showMoveToReview={props.showMoveToReview}
        onMoveToReview={props.onMoveToReview}
        showApproveReject={props.showApproveReject}
        onApprove={props.onApprove}
        onReject={props.onReject}
        showReenrich={props.showReenrich}
        onReenrich={props.onReenrich}
        showApprovedNote={props.showApprovedNote}
        itemId={props.itemId}
      />
    </ActionsCard>
  );
}
