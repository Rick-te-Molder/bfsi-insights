'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DetailPanel } from './detail-panel';
import { bulkApproveAction, bulkRejectAction, bulkReenrichAction } from './actions';
import {
  renderItemList as renderItemListExternal,
  type RenderItemListProps as RenderItemListPropsExternal,
} from './components/ItemListRenderer';
import type { TaxonomyConfig, TaxonomyData } from '@/components/tags';
import type { QueueItem } from '@bfsi/types';

// Get primary audience from scores
function _getPrimaryAudience(scores?: Record<string, number>): string | null {
  if (!scores) return null;
  const entries = Object.entries(scores).filter(([, v]) => v && v >= 0.5);
  if (entries.length === 0) return null;
  sortAudienceEntries(entries);
  return entries[0][0];
}

function sortAudienceEntries(entries: [string, number | undefined][]) {
  return entries.sort((a, b) => (b[1] || 0) - (a[1] || 0));
}

interface MasterDetailViewProps {
  items: QueueItem[];
  taxonomyConfig: TaxonomyConfig[];
  taxonomyData: TaxonomyData;
}

type MasterViewState = {
  selectedId: string | null;
  listItems: QueueItem[];
  selectedIndex: number;
  setSelectedId: (id: string | null) => void;
  setListItems: (items: QueueItem[]) => void;
};

function useNavigateHandler(
  selectedIndex: number,
  listItems: QueueItem[],
  setSelectedId: (id: string | null) => void,
) {
  return useCallback(
    (direction: 'prev' | 'next') => {
      if (direction === 'prev' && selectedIndex > 0) {
        setSelectedId(listItems[selectedIndex - 1].id);
      } else if (direction === 'next' && selectedIndex < listItems.length - 1) {
        setSelectedId(listItems[selectedIndex + 1].id);
      }
    },
    [selectedIndex, listItems, setSelectedId],
  );
}

function useActionHandler(
  listItems: QueueItem[],
  setListItems: (items: QueueItem[]) => void,
  setSelectedId: (id: string | null) => void,
  router: ReturnType<typeof useRouter>,
) {
  const performAction = createPerformAction();
  const updateStateAfterAction = createUpdateStateAfterAction();

  return useCallback(
    async (action: 'approve' | 'reject' | 'reenrich', itemId: string) => {
      try {
        const result = await performAction(action, itemId);
        if (result.success) {
          const currentIndex = listItems.findIndex((item) => item.id === itemId);
          updateStateAfterAction(itemId, currentIndex, listItems, setListItems, setSelectedId);
          router.refresh();
        }
      } catch {
        // User cancelled or error occurred
      }
    },
    [listItems, setListItems, setSelectedId, router, performAction, updateStateAfterAction],
  );
}

function createPerformAction() {
  return async (action: 'approve' | 'reject' | 'reenrich', itemId: string) => {
    if (action === 'approve') return await bulkApproveAction([itemId]);
    if (action === 'reject') {
      const reason = prompt('Rejection reason:');
      if (!reason) throw new Error('Reason required');
      return await bulkRejectAction([itemId], reason);
    }
    return await bulkReenrichAction([itemId]);
  };
}

function createUpdateStateAfterAction() {
  return (
    itemId: string,
    currentIndex: number,
    listItems: QueueItem[],
    setListItems: (items: QueueItem[]) => void,
    setSelectedId: (id: string | null) => void,
  ) => {
    const newItems = listItems.filter((item) => item.id !== itemId);
    setListItems(newItems);

    if (newItems.length > 0) {
      const nextIndex = Math.min(currentIndex, newItems.length - 1);
      setSelectedId(newItems[nextIndex].id);
    } else {
      setSelectedId(null);
    }
  };
}

function useCloseHandler(setSelectedId: (id: string | null) => void) {
  return useCallback(() => {
    setSelectedId(null);
  }, [setSelectedId]);
}

function useMasterViewState(items: QueueItem[]): MasterViewState {
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id || null);
  const [listItems, setListItems] = useState(items);

  useEffect(() => {
    setListItems(items);
    setSelectedId(items[0]?.id || null);
  }, [items]);

  const selectedIndex = listItems.findIndex((item) => item.id === selectedId);

  return { selectedId, listItems, selectedIndex, setSelectedId, setListItems };
}

function useMasterViewActions(
  listItems: QueueItem[],
  setListItems: (items: QueueItem[]) => void,
  setSelectedId: (id: string | null) => void,
  router: ReturnType<typeof useRouter>,
  selectedIndex: number,
) {
  const handleNavigate = useNavigateHandler(selectedIndex, listItems, setSelectedId);
  const handleAction = useActionHandler(listItems, setListItems, setSelectedId, router);
  const handleClose = useCloseHandler(setSelectedId);

  return { handleNavigate, handleAction, handleClose };
}

export function MasterDetailView({ items, taxonomyConfig, taxonomyData }: MasterDetailViewProps) {
  const router = useRouter();
  const { selectedId, listItems, selectedIndex, setSelectedId, setListItems } =
    useMasterViewState(items);
  const { handleNavigate, handleAction, handleClose } = useMasterViewActions(
    listItems,
    setListItems,
    setSelectedId,
    router,
    selectedIndex,
  );

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-4">
      {renderItemList({ listItems, selectedId, setSelectedId, taxonomyConfig, taxonomyData })}
      {renderDetailPanel({
        selectedId,
        handleClose,
        handleAction,
        handleNavigate,
        selectedIndex,
        listItems,
        taxonomyConfig,
        taxonomyData,
      })}
    </div>
  );
}

type RenderItemListProps = RenderItemListPropsExternal;

function renderItemList(props: RenderItemListProps) {
  return renderItemListExternal(props);
}

type RenderDetailPanelProps = {
  selectedId: string | null;
  handleClose: () => void;
  handleAction: (action: 'approve' | 'reject' | 'reenrich', itemId: string) => Promise<void>;
  handleNavigate: (direction: 'prev' | 'next') => void;
  selectedIndex: number;
  listItems: QueueItem[];
  taxonomyConfig: TaxonomyConfig[];
  taxonomyData: TaxonomyData;
};

function renderDetailPanel(props: RenderDetailPanelProps) {
  const {
    selectedId,
    handleClose,
    handleAction,
    handleNavigate,
    selectedIndex,
    listItems,
    taxonomyConfig,
    taxonomyData,
  } = props;
  return (
    <div className="w-1/2 rounded-xl border border-neutral-800 bg-neutral-900/60 overflow-hidden">
      <DetailPanel
        itemId={selectedId}
        onClose={handleClose}
        onAction={handleAction}
        onNavigate={handleNavigate}
        canNavigatePrev={selectedIndex > 0}
        canNavigateNext={selectedIndex < listItems.length - 1}
        taxonomyConfig={taxonomyConfig}
        taxonomyData={taxonomyData}
      />
    </div>
  );
}
