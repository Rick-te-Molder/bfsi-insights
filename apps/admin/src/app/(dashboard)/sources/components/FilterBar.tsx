'use client';

import { CategoryFilter, TierFilter, StatusFilter, HealthFilter } from './FilterComponents';
import type { FilterCategory, FilterTier, FilterEnabled, FilterHealth } from '../types';

interface FilterBarProps {
  filterCategory: FilterCategory;
  setFilterCategory: (v: FilterCategory) => void;
  filterTier: FilterTier;
  setFilterTier: (v: FilterTier) => void;
  filterEnabled: FilterEnabled;
  setFilterEnabled: (v: FilterEnabled) => void;
  filterHealth: FilterHealth;
  setFilterHealth: (v: FilterHealth) => void;
  categories: string[];
}

export function FilterBar({
  filterCategory,
  setFilterCategory,
  filterTier,
  setFilterTier,
  filterEnabled,
  setFilterEnabled,
  filterHealth,
  setFilterHealth,
  categories,
}: FilterBarProps) {
  return (
    <div className="mb-6 flex flex-wrap gap-4 rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
      <CategoryFilter value={filterCategory} onChange={setFilterCategory} categories={categories} />
      <TierFilter value={filterTier} onChange={setFilterTier} />
      <StatusFilter value={filterEnabled} onChange={setFilterEnabled} />
      <HealthFilter value={filterHealth} onChange={setFilterHealth} />
    </div>
  );
}
