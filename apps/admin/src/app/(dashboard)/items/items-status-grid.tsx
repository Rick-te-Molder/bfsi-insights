'use client';

import { cn } from '@/lib/utils';
import { StatusPill } from '@/components/ui/status-pill';
import {
  buildStatusCategories,
  ExpandableCategoryHeader,
  STATUS_CATEGORY_CONFIG,
  type CategoryData,
  type StatusCategoryKey,
} from '@/components/dashboard/status-grid-common';
import { useStatusGridExpansion } from '@/components/dashboard/use-status-grid-expansion';

type ItemsCategoryData = CategoryData & { activeColor: string };

interface ItemsStatusGridProps {
  statusData: {
    code: number;
    name: string;
    category: string;
    count: number;
  }[];
  currentStatus: string;
  currentSource: string;
  currentTime: string;
  currentView: string;
}

const CATEGORY_ORDER: StatusCategoryKey[] = ['enrichment', 'review', 'published', 'terminal'];

const ACTIVE_COLORS: Record<StatusCategoryKey, string> = {
  discovery: 'bg-violet-600',
  enrichment: 'bg-cyan-600',
  review: 'bg-amber-600',
  published: 'bg-emerald-600',
  terminal: 'bg-neutral-600',
};

function buildFilterUrl(status: string, source: string, time: string, view: string): string {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (source) params.set('source', source);
  if (time) params.set('time', time);
  if (view && view !== 'split') params.set('view', view);
  return `/items?${params.toString()}`;
}

function buildItemsCategories(statusData: ItemsStatusGridProps['statusData']): ItemsCategoryData[] {
  const categories = buildStatusCategories({
    statusData,
    order: CATEGORY_ORDER,
    config: STATUS_CATEGORY_CONFIG,
  });
  return categories.map((c) => ({ ...c, activeColor: ACTIVE_COLORS[c.category] }));
}

type FilterContext = {
  currentStatus: string;
  currentSource: string;
  currentTime: string;
  currentView: string;
};

function CategoryStatusPill({
  s,
  cat,
  ctx,
}: Readonly<{
  s: { code: number; name: string; count: number };
  cat: ItemsCategoryData;
  ctx: FilterContext;
}>) {
  return (
    <StatusPill
      key={s.code}
      code={s.code}
      name={s.name}
      count={s.count}
      color={cat.color}
      borderColor={cat.borderColor}
      isActive={ctx.currentStatus === s.name}
      activeColor={cat.activeColor}
      href={buildFilterUrl(s.name, ctx.currentSource, ctx.currentTime, ctx.currentView)}
    />
  );
}

function ItemsCategoryPills({
  cat,
  ctx,
}: Readonly<{ cat: ItemsCategoryData; ctx: FilterContext }>) {
  if (cat.statuses.length === 0) return null;
  return (
    <div className="px-3 pb-3 pl-10">
      <div className="flex flex-wrap gap-2">
        {cat.statuses.map((s) => (
          <CategoryStatusPill key={s.code} s={s} cat={cat} ctx={ctx} />
        ))}
      </div>
    </div>
  );
}

function ItemsCategoryRow({
  cat,
  isExpanded,
  onToggle,
  ctx,
}: Readonly<{
  cat: ItemsCategoryData;
  isExpanded: boolean;
  onToggle: () => void;
  ctx: FilterContext;
}>) {
  return (
    <div className={cn(cat.category === 'terminal' && 'opacity-60')}>
      <ExpandableCategoryHeader
        label={cat.label}
        total={cat.total}
        color={cat.color}
        isExpanded={isExpanded}
        onToggle={onToggle}
      />
      {isExpanded && <ItemsCategoryPills cat={cat} ctx={ctx} />}
    </div>
  );
}

export function ItemsStatusGrid({
  statusData,
  currentStatus,
  currentSource,
  currentTime,
  currentView,
}: Readonly<ItemsStatusGridProps>) {
  const { expanded, toggle } = useStatusGridExpansion([
    'enrichment',
    'review',
    'published',
    'terminal',
  ]);
  const categories = buildItemsCategories(statusData);
  const ctx: FilterContext = { currentStatus, currentSource, currentTime, currentView };
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 divide-y divide-neutral-800">
      {categories.map((cat) => (
        <ItemsCategoryRow
          key={cat.category}
          cat={cat}
          isExpanded={expanded.has(cat.category)}
          onToggle={() => toggle(cat.category)}
          ctx={ctx}
        />
      ))}
    </div>
  );
}
