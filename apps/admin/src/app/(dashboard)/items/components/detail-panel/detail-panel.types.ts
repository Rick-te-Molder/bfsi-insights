import type { TaxonomyConfig, TaxonomyData } from '@/components/tags';
import type { QueueItem } from '@bfsi/types';

export type SummaryPayload = { short?: string; medium?: string; long?: string };

export type ItemPayload = Record<string, unknown>;

export type ActionType = 'approve' | 'reject' | 'reenrich';

export type DetailPanelViewProps = {
  actionLoading: string | null;
  canNavigateNext: boolean;
  canNavigatePrev: boolean;
  discoveredAt: string;
  handleAction: (action: ActionType) => void;
  itemId: string | null;
  loading: boolean;
  onClose: () => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  payload: ItemPayload;
  selectedItem: QueueItem | null;
  taxonomyConfig: TaxonomyConfig[];
  taxonomyData: TaxonomyData;
};

export type DetailPanelActionsProps = {
  actionLoading: string | null;
  handleAction: (action: ActionType) => void;
  statusCode: number;
};

export type DetailPanelHeaderProps = {
  itemId: string;
  onClose: () => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  canNavigatePrev: boolean;
  canNavigateNext: boolean;
  payload: ItemPayload;
  statusCode: number;
  url: string;
};

export type DetailPanelTitleBlockProps = {
  itemId: string;
  payload: ItemPayload;
  statusCode: number;
  url: string;
};

export type DetailPanelMetadataProps = {
  payload: ItemPayload;
  discoveredAt: string;
};

export type DetailPanelClassificationProps = {
  payload: ItemPayload;
  taxonomyConfig: TaxonomyConfig[];
  taxonomyData: TaxonomyData;
};
