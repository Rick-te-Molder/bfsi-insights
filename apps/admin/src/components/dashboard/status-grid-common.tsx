'use client';

import { cn } from '@/lib/utils';

export const ChevronDown = ({ size = 16 }: { size?: number }) => (
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

export const ChevronRight = ({ size = 16 }: { size?: number }) => (
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

export interface StatusCode {
  code: number;
  name: string;
  count: number;
}

export type StatusCategoryKey = 'discovery' | 'enrichment' | 'review' | 'published' | 'terminal';

export interface CategoryConfig {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export const STATUS_CATEGORY_CONFIG: Record<StatusCategoryKey, CategoryConfig> = {
  discovery: {
    label: 'Discovery',
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/30',
  },
  enrichment: {
    label: 'Enrichment',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/30',
  },
  review: {
    label: 'Review',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
  },
  published: {
    label: 'Published',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
  },
  terminal: {
    label: 'Terminal',
    color: 'text-neutral-400',
    bgColor: 'bg-neutral-500/10',
    borderColor: 'border-neutral-500/30',
  },
};

export interface CategoryData {
  category: StatusCategoryKey;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  statuses: StatusCode[];
  total: number;
}

export function buildStatusCategories(opts: {
  statusData: { code: number; name: string; category: string; count: number }[];
  order: StatusCategoryKey[];
  config: Record<StatusCategoryKey, CategoryConfig>;
}): CategoryData[] {
  const safeData = opts.statusData || [];
  return opts.order.map((key) => {
    const cfg = opts.config[key];
    const statuses = safeData.filter((s) => s.category === key).sort((a, b) => a.code - b.code);
    return {
      category: key,
      ...cfg,
      statuses,
      total: statuses.reduce((sum, s) => sum + s.count, 0),
    };
  });
}

export function ExpandableCategoryHeader({
  label,
  total,
  color,
  isExpanded,
  onToggle,
}: Readonly<{
  label: string;
  total: number;
  color: string;
  isExpanded: boolean;
  onToggle: () => void;
}>) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-3 p-3 hover:bg-neutral-800/50 transition-colors"
    >
      <span className={cn('font-medium', color)}>{label}</span>
      <span className={cn('text-xl font-bold ml-auto', color)}>{total}</span>
      <span className="text-neutral-500 ml-2">
        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </span>
    </button>
  );
}
