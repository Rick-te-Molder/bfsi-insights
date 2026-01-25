import { useState } from 'react';
import type { Source } from '@/types/database';
import type { FilterTier, FilterEnabled, FilterHealth, SourceHealth } from '../types';

export function useSourceFilters() {
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterTier, setFilterTier] = useState<FilterTier>('all');
  const [filterEnabled, setFilterEnabled] = useState<FilterEnabled>('all');
  const [filterHealth, setFilterHealth] = useState<FilterHealth>('all');

  return {
    filterCategory,
    setFilterCategory,
    filterTier,
    setFilterTier,
    filterEnabled,
    setFilterEnabled,
    filterHealth,
    setFilterHealth,
  };
}

interface FilterOptions {
  sources: Source[];
  healthData: Map<string, SourceHealth>;
  filterCategory: string;
  filterTier: FilterTier;
  filterEnabled: FilterEnabled;
  filterHealth: FilterHealth;
}

export function filterSources(opts: FilterOptions): Source[] {
  const { sources, healthData, filterCategory, filterTier, filterEnabled, filterHealth } = opts;
  return sources.filter((s) => {
    if (filterCategory !== 'all' && s.category !== filterCategory) return false;
    if (filterTier !== 'all' && s.tier !== filterTier) return false;
    if (filterEnabled !== 'all' && String(s.enabled) !== filterEnabled) return false;
    if (filterHealth !== 'all') {
      const h = healthData.get(s.slug);
      if ((h?.health_status || 'inactive') !== filterHealth) return false;
    }
    return true;
  });
}
