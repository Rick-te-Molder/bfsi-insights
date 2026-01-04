'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { TaxonomyConfig, TaxonomyData } from '@/components/tags';
import type { QueueItem as _QueueItem } from '@bfsi/types';
import { useDetailPanelData } from './components/detail-panel/useDetailPanelData';
import { useKeyboardShortcuts } from './components/detail-panel/useKeyboardShortcuts';
import { DetailPanelView } from './components/detail-panel/DetailPanelView';
import type { ActionType } from './components/detail-panel/detail-panel.types';

interface DetailPanelProps {
  itemId: string | null;
  onClose: () => void;
  onAction: (action: ActionType, itemId: string) => Promise<void>;
  onNavigate: (direction: 'prev' | 'next') => void;
  canNavigatePrev: boolean;
  canNavigateNext: boolean;
  taxonomyConfig: TaxonomyConfig[];
  taxonomyData: TaxonomyData;
}

function useDetailPanelAction(itemId: string | null, onAction: DetailPanelProps['onAction']) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const handleAction = useCallback(
    async (action: ActionType) => {
      if (!itemId) return;
      setActionLoading(action);
      await onAction(action, itemId);
      setActionLoading(null);
    },
    [itemId, onAction],
  );
  return { actionLoading, handleAction };
}

function useDetailPanelShortcuts(
  props: DetailPanelProps,
  item: _QueueItem | null,
  actionLoading: string | null,
  handleAction: (a: ActionType) => Promise<void>,
) {
  const router = useRouter();
  useKeyboardShortcuts({
    itemId: props.itemId,
    actionLoading,
    canNavigatePrev: props.canNavigatePrev,
    canNavigateNext: props.canNavigateNext,
    onNavigate: props.onNavigate,
    onClose: props.onClose,
    onApprove: () => item?.status_code === 300 && handleAction('approve'),
    onReject: () => [300, 500].includes(item?.status_code || 0) && handleAction('reject'),
    onReenrich: () => handleAction('reenrich'),
    onViewFull: () => router.push(`/items/${props.itemId}`),
  });
}

function buildViewProps(
  props: DetailPanelProps,
  item: _QueueItem | null,
  loading: boolean,
  actionLoading: string | null,
  handleAction: (a: ActionType) => void,
) {
  return {
    itemId: props.itemId,
    loading,
    selectedItem: item,
    payload: (item?.payload || {}) as Record<string, unknown>,
    discoveredAt: item?.discovered_at || '',
    taxonomyConfig: props.taxonomyConfig,
    taxonomyData: props.taxonomyData,
    onClose: props.onClose,
    onNavigate: props.onNavigate,
    canNavigatePrev: props.canNavigatePrev,
    canNavigateNext: props.canNavigateNext,
    actionLoading,
    handleAction,
  };
}

export function DetailPanel(props: DetailPanelProps) {
  const { item, loading } = useDetailPanelData(props.itemId);
  const { actionLoading, handleAction } = useDetailPanelAction(props.itemId, props.onAction);
  useDetailPanelShortcuts(props, (item as _QueueItem) || null, actionLoading, handleAction);
  return (
    <DetailPanelView
      {...buildViewProps(
        props,
        (item as _QueueItem) || null,
        loading,
        actionLoading,
        (a) => void handleAction(a),
      )}
    />
  );
}
