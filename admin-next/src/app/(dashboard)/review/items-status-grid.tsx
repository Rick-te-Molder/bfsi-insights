'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

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
  buildFilterUrl: (params: Record<string, string>) => string;
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

export function ItemsStatusGrid({
  statusData,
  currentStatus,
  buildFilterUrl,
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
                  {cat.statuses.map((status) => {
                    const isActive = currentStatus === status.name;
                    return (
                      <Link
                        key={status.code}
                        href={buildFilterUrl({ status: status.name })}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors',
                          isActive
                            ? `${config.activeColor} text-white border-transparent`
                            : status.count > 0
                              ? `${cat.bgColor} ${cat.borderColor} hover:bg-opacity-20`
                              : 'bg-neutral-800/50 border-neutral-700 hover:bg-neutral-700/50',
                          'border',
                        )}
                        title={`Code ${status.code}: ${status.name} (${status.count} items)`}
                      >
                        <span className={isActive ? 'text-white' : 'text-neutral-400'}>
                          {status.name.replace(/_/g, ' ')}
                        </span>
                        <span
                          className={cn(
                            'font-semibold',
                            isActive
                              ? 'text-white'
                              : status.count > 0
                                ? cat.color
                                : 'text-neutral-500',
                          )}
                        >
                          {status.count}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
