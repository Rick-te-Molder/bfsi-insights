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

interface PipelineStatusGridProps {
  statusData: {
    code: number;
    name: string;
    category: string;
    count: number;
  }[];
}
const CATEGORY_ORDER: StatusCategoryKey[] = [
  'discovery',
  'enrichment',
  'review',
  'published',
  'terminal',
];

function buildCategories(statusData: PipelineStatusGridProps['statusData']): CategoryData[] {
  return buildStatusCategories({
    statusData,
    order: CATEGORY_ORDER,
    config: STATUS_CATEGORY_CONFIG,
  });
}

function CategoryPills({ cat }: Readonly<{ cat: CategoryData }>) {
  if (cat.statuses.length === 0) return null;
  return (
    <div className="px-3 pb-3 pl-10">
      <div className="flex flex-wrap gap-2">
        {cat.statuses.map((s) => (
          <StatusPill
            key={s.code}
            code={s.code}
            name={s.name}
            count={s.count}
            color={cat.color}
            borderColor={cat.borderColor}
          />
        ))}
      </div>
    </div>
  );
}

function CategoryRow({
  cat,
  isExpanded,
  onToggle,
}: Readonly<{ cat: CategoryData; isExpanded: boolean; onToggle: () => void }>) {
  return (
    <div className={cn(cat.category === 'terminal' && 'opacity-60')}>
      <ExpandableCategoryHeader
        label={cat.label}
        total={cat.total}
        color={cat.color}
        isExpanded={isExpanded}
        onToggle={onToggle}
      />
      {isExpanded && <CategoryPills cat={cat} />}
    </div>
  );
}

export function PipelineStatusGrid({ statusData }: Readonly<PipelineStatusGridProps>) {
  const { expanded, toggle } = useStatusGridExpansion(['discovery', 'enrichment', 'review']);
  const categories = buildCategories(statusData);
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 divide-y divide-neutral-800">
      {categories.map((cat) => (
        <CategoryRow
          key={cat.category}
          cat={cat}
          isExpanded={expanded.has(cat.category)}
          onToggle={() => toggle(cat.category)}
        />
      ))}
    </div>
  );
}
