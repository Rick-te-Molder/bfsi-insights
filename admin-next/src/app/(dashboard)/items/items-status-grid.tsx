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

export function ItemsStatusGrid({
  statusData,
  currentStatus,
  currentSource,
  currentTime,
  currentView,
}: ItemsStatusGridProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['enrichment', 'review', 'published', 'terminal']),
  );

  const safeStatusData = statusData || [];

  const categories: CategoryData[] = CATEGORY_ORDER.map((categoryKey) => {
    const config = CATEGORY_CONFIG[categoryKey];
    const statuses = safeStatusData
      .filter((s) => s.category === categoryKey)
      .sort((a, b) => a.code - b.code);
    const total = statuses.reduce((sum, s) => sum + s.count, 0);

    return {
      category: categoryKey,
      ...config,
      statuses,
      total,
    };
  });

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 divide-y divide-neutral-800">
      {categories.map((cat) => {
        const isExpanded = expandedCategories.has(cat.category);
        const isTerminal = cat.category === 'terminal';
        const config = CATEGORY_CONFIG[cat.category];

        return (
          <div key={cat.category} className={cn(isTerminal && 'opacity-60')}>
            {/* Category Header */}
            <button
              onClick={() => toggleCategory(cat.category)}
              className="w-full flex items-center gap-3 p-3 hover:bg-neutral-800/50 transition-colors"
            >
              <span className={cn('font-medium', cat.color)}>{cat.label}</span>
              <span className={cn('text-xl font-bold ml-auto', cat.color)}>{cat.total}</span>
              <span className="text-neutral-500 ml-2">
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </span>
            </button>

            {/* Status Pills - Clickable Links */}
            {isExpanded && cat.statuses.length > 0 && (
              <div className="px-3 pb-3 pl-10">
                <div className="flex flex-wrap gap-2">
                  {cat.statuses.map((status) => (
                    <StatusPill
                      key={status.code}
                      code={status.code}
                      name={status.name}
                      count={status.count}
                      color={cat.color}
                      borderColor={cat.borderColor}
                      isActive={currentStatus === status.name}
                      activeColor={config.activeColor}
                      href={buildFilterUrl(status.name, currentSource, currentTime, currentView)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
