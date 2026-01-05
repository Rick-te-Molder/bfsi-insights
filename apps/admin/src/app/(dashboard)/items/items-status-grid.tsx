'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { StatusPill } from '@/components/ui/status-pill';

const ChevronDown = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M6 9l6 6 6-6" />
  </svg>
);

const ChevronRight = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M9 18l6-6-6-6" />
  </svg>
);

interface StatusCode {
  code: number;
  name: string;
  count: number;
}

interface CategoryData {
  category: string;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  statuses: StatusCode[];
  total: number;
}

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

const CATEGORY_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string; borderColor: string; activeColor: string }
> = {
  discovery: {
    label: 'Discovery',
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/30',
    activeColor: 'bg-violet-600',
  },
  enrichment: {
    label: 'Enrichment',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/30',
    activeColor: 'bg-cyan-600',
  },
  review: {
    label: 'Review',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    activeColor: 'bg-amber-600',
  },
  published: {
    label: 'Published',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    activeColor: 'bg-emerald-600',
  },
  terminal: {
    label: 'Terminal',
    color: 'text-neutral-400',
    bgColor: 'bg-neutral-500/10',
    borderColor: 'border-neutral-500/30',
    activeColor: 'bg-neutral-600',
  },
};

const CATEGORY_ORDER = ['enrichment', 'review', 'published', 'terminal'];

function buildFilterUrl(status: string, source: string, time: string, view: string): string {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (source) params.set('source', source);
  if (time) params.set('time', time);
  if (view && view !== 'split') params.set('view', view);
  return `/items?${params.toString()}`;
}

function buildItemsCategories(statusData: ItemsStatusGridProps['statusData']): CategoryData[] {
  const safeData = statusData || [];
  return CATEGORY_ORDER.map((key) => {
    const config = CATEGORY_CONFIG[key];
    const statuses = safeData.filter((s) => s.category === key).sort((a, b) => a.code - b.code);
    return {
      category: key,
      ...config,
      statuses,
      total: statuses.reduce((sum, s) => sum + s.count, 0),
    };
  });
}

function ItemsCategoryHeader({
  cat,
  isExpanded,
  onToggle,
}: Readonly<{ cat: CategoryData; isExpanded: boolean; onToggle: () => void }>) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-3 p-3 hover:bg-neutral-800/50 transition-colors"
    >
      <span className={cn('font-medium', cat.color)}>{cat.label}</span>
      <span className={cn('text-xl font-bold ml-auto', cat.color)}>{cat.total}</span>
      <span className="text-neutral-500 ml-2">
        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </span>
    </button>
  );
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
  cat: CategoryData;
  ctx: FilterContext;
}>) {
  const config = CATEGORY_CONFIG[cat.category];
  return (
    <StatusPill
      key={s.code}
      code={s.code}
      name={s.name}
      count={s.count}
      color={cat.color}
      borderColor={cat.borderColor}
      isActive={ctx.currentStatus === s.name}
      activeColor={config.activeColor}
      href={buildFilterUrl(s.name, ctx.currentSource, ctx.currentTime, ctx.currentView)}
    />
  );
}

function ItemsCategoryPills({ cat, ctx }: Readonly<{ cat: CategoryData; ctx: FilterContext }>) {
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
}: Readonly<{ cat: CategoryData; isExpanded: boolean; onToggle: () => void; ctx: FilterContext }>) {
  return (
    <div className={cn(cat.category === 'terminal' && 'opacity-60')}>
      <ItemsCategoryHeader cat={cat} isExpanded={isExpanded} onToggle={onToggle} />
      {isExpanded && <ItemsCategoryPills cat={cat} ctx={ctx} />}
    </div>
  );
}

function useExpandedState() {
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(['enrichment', 'review', 'published', 'terminal']),
  );
  const toggle = (c: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  return { expanded, toggle };
}

export function ItemsStatusGrid({
  statusData,
  currentStatus,
  currentSource,
  currentTime,
  currentView,
}: Readonly<ItemsStatusGridProps>) {
  const { expanded, toggle } = useExpandedState();
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
