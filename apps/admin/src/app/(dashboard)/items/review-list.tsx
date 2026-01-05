'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { TaxonomyConfig, TaxonomyData } from '@/components/tags';
import type { QueueItem } from '@bfsi/types';
import { SuccessBanner, LoadingIndicator, ItemRow, EmptyState } from './review-list-components';
import { BulkActionsBar, getActionPermissions } from './review-list-bulk-actions';
import { useBulkActions } from './review-list-hooks';

interface ReviewListProps {
  items: QueueItem[];
  status: string;
  taxonomyConfig: TaxonomyConfig[];
  taxonomyData: TaxonomyData;
}

function useSelection(items: QueueItem[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectAll = () =>
    setSelected(selected.size === items.length ? new Set() : new Set(items.map((i) => i.id)));
  return { selected, setSelected, toggle, selectAll };
}

function ItemsList({
  items,
  selected,
  toggle,
}: Readonly<{
  items: QueueItem[];
  selected: Set<string>;
  toggle: (id: string, e: React.MouseEvent) => void;
}>) {
  if (items.length === 0) return <EmptyState />;
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 divide-y divide-neutral-800">
      {items.map((item) => (
        <ItemRow
          key={item.id}
          item={item}
          isSelected={selected.has(item.id)}
          onToggle={(e) => toggle(item.id, e)}
        />
      ))}
    </div>
  );
}

export function ReviewList({
  items,
  status,
  taxonomyConfig: _tc,
  taxonomyData: _td,
}: Readonly<ReviewListProps>) {
  const router = useRouter();
  const { selected, setSelected, toggle, selectAll } = useSelection(items);
  const { loading, message, actions } = useBulkActions(selected, setSelected, router);
  const permissions = getActionPermissions(status);

  return (
    <div className="space-y-4">
      <SuccessBanner message={message} />
      <LoadingIndicator loading={loading} />
      <BulkActionsBar
        items={items}
        selected={selected}
        loading={loading}
        selectAll={selectAll}
        permissions={permissions}
        actions={actions}
      />
      <ItemsList items={items} selected={selected} toggle={toggle} />
    </div>
  );
}
