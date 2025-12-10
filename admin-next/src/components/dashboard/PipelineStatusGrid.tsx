'use client';

import { useState } from 'react';
// Simple chevron icons
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
import { cn } from '@/lib/utils';

interface StatusCode {
  code: number;
  name: string;
  count: number;
}

interface CategoryData {
  category: string;
  label: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  statuses: StatusCode[];
  total: number;
}

interface PipelineStatusGridProps {
  statusData: {
    code: number;
    name: string;
    category: string;
    count: number;
  }[];
}

const CATEGORY_CONFIG: Record<
  string,
  { label: string; icon: string; color: string; bgColor: string; borderColor: string }
> = {
  discovery: {
    label: 'Discovery',
    icon: '🔍',
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/30',
  },
  enrichment: {
    label: 'Enrichment',
    icon: '⚙️',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/30',
  },
  review: {
    label: 'Review',
    icon: '👁️',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
  },
  published: {
    label: 'Published',
    icon: '✅',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
  },
  terminal: {
    label: 'Terminal',
    icon: '🗑️',
    color: 'text-neutral-400',
    bgColor: 'bg-neutral-500/10',
    borderColor: 'border-neutral-500/30',
  },
};

const CATEGORY_ORDER = ['discovery', 'enrichment', 'review', 'published', 'terminal'];

export function PipelineStatusGrid({ statusData }: PipelineStatusGridProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['discovery', 'enrichment', 'review']),
  );

  // Group status data by category
  const categories: CategoryData[] = CATEGORY_ORDER.map((categoryKey) => {
    const config = CATEGORY_CONFIG[categoryKey];
    const statuses = statusData
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

  // Calculate summary totals
  const inPipelineTotal = categories
    .filter((c) => ['discovery', 'enrichment', 'review'].includes(c.category))
    .reduce((sum, c) => sum + c.total, 0);

  const publishedTotal = categories.find((c) => c.category === 'published')?.total || 0;
  const terminalTotal = categories.find((c) => c.category === 'terminal')?.total || 0;

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
    <div className="space-y-4">
      {/* Summary Boxes */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-4">
          <p className="text-xs text-neutral-400">In Pipeline</p>
          <p className="mt-1 text-2xl font-bold text-sky-400">{inPipelineTotal}</p>
          <p className="text-[10px] text-neutral-500">Discovery + Enrichment + Review</p>
        </div>
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="text-xs text-neutral-400">Published</p>
          <p className="mt-1 text-2xl font-bold text-emerald-400">{publishedTotal}</p>
          <p className="text-[10px] text-neutral-500">Live on site</p>
        </div>
        <div className="rounded-xl border border-neutral-500/30 bg-neutral-500/10 p-4">
          <p className="text-xs text-neutral-400">Terminal</p>
          <p className="mt-1 text-2xl font-bold text-neutral-400">{terminalTotal}</p>
          <p className="text-[10px] text-neutral-500">Failed + Rejected</p>
        </div>
      </div>

      {/* Category Rows */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 divide-y divide-neutral-800">
        {categories.map((cat) => {
          const isExpanded = expandedCategories.has(cat.category);
          const isTerminal = cat.category === 'terminal';

          return (
            <div key={cat.category} className={cn(isTerminal && 'opacity-60')}>
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(cat.category)}
                className="w-full flex items-center gap-3 p-3 hover:bg-neutral-800/50 transition-colors"
              >
                <span className="text-lg">{cat.icon}</span>
                <span className={cn('font-medium', cat.color)}>{cat.label}</span>
                <span className={cn('text-xl font-bold ml-auto', cat.color)}>{cat.total}</span>
                <span className="text-neutral-500 ml-2">
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </span>
              </button>

              {/* Status Pills */}
              {isExpanded && cat.statuses.length > 0 && (
                <div className="px-3 pb-3 pl-10">
                  <div className="flex flex-wrap gap-2">
                    {cat.statuses.map((status) => (
                      <div
                        key={status.code}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs',
                          status.count > 0 ? cat.bgColor : 'bg-neutral-800/50',
                          status.count > 0 ? cat.borderColor : 'border-neutral-700',
                          'border',
                        )}
                        title={`Code ${status.code}: ${status.name}`}
                      >
                        <span className="text-neutral-400">{status.name.replace(/_/g, ' ')}</span>
                        <span
                          className={cn(
                            'font-semibold',
                            status.count > 0 ? cat.color : 'text-neutral-500',
                          )}
                        >
                          {status.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
