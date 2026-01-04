'use client';

import type { DetailPanelViewProps, SummaryPayload } from './detail-panel.types';
import { DetailPanelHeader } from './DetailPanelHeader';
import { DetailPanelActions } from './DetailPanelActions';
import {
  DetailPanelClassification,
  DetailPanelFooter,
  DetailPanelMetadata,
  DetailPanelSummary,
} from './DetailPanelSections';
import { DetailPanelEmpty, DetailPanelLoading, DetailPanelNotFound } from './DetailPanelStates';

function DetailPanelBody(props: DetailPanelViewProps & { summary: SummaryPayload }) {
  const { selectedItem } = props;
  if (!selectedItem) return null;
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <DetailPanelActions
        actionLoading={props.actionLoading}
        handleAction={props.handleAction}
        statusCode={selectedItem.status_code}
      />
      <DetailPanelSummary summary={props.summary} />
      <DetailPanelClassification
        payload={props.payload}
        taxonomyConfig={props.taxonomyConfig}
        taxonomyData={props.taxonomyData}
      />
      <DetailPanelMetadata payload={props.payload} discoveredAt={props.discoveredAt} />
    </div>
  );
}

export function DetailPanelView(props: DetailPanelViewProps) {
  if (!props.itemId) return <DetailPanelEmpty />;
  if (props.loading) return <DetailPanelLoading />;
  if (!props.selectedItem) return <DetailPanelNotFound />;

  const summary = (props.payload.summary as SummaryPayload) || {};

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <DetailPanelHeader
        itemId={props.itemId}
        onClose={props.onClose}
        onNavigate={props.onNavigate}
        canNavigatePrev={props.canNavigatePrev}
        canNavigateNext={props.canNavigateNext}
        payload={props.payload}
        statusCode={props.selectedItem.status_code}
        url={props.selectedItem.url}
      />
      <DetailPanelBody {...props} summary={summary} />
      <DetailPanelFooter />
    </div>
  );
}
