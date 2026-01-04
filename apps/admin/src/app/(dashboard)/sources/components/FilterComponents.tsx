'use client';

import type { FilterTier, FilterEnabled, FilterHealth } from '../types';

export function PageHeader({ onAdd }: Readonly<{ onAdd: () => void }>) {
  return (
    <header className="mb-6 flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-white">Sources</h1>
        <p className="mt-1 text-sm text-neutral-400">Configure discovery sources and priorities</p>
      </div>
      <button
        onClick={onAdd}
        className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
      >
        + Add Source
      </button>
    </header>
  );
}

export function StatsBadges({
  stats,
}: Readonly<{
  stats: { total: number; enabled: number; premium: number; withRss: number; withScraper: number };
}>) {
  return (
    <div className="mb-6 flex flex-wrap gap-3 text-sm">
      <span className="rounded-full bg-neutral-800 px-3 py-1">{stats.total} total</span>
      <span className="rounded-full bg-emerald-500/20 text-emerald-300 px-3 py-1">
        {stats.enabled} enabled
      </span>
      <span className="rounded-full bg-amber-500/20 text-amber-300 px-3 py-1">
        {stats.premium} premium
      </span>
      <span className="rounded-full bg-sky-500/20 text-sky-300 px-3 py-1">{stats.withRss} RSS</span>
      <span className="rounded-full bg-purple-500/20 text-purple-300 px-3 py-1">
        {stats.withScraper} scrapers
      </span>
    </div>
  );
}

export function Legend() {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-6 text-xs text-neutral-500">
      <span className="font-medium">Discovery:</span>
      <span title="RSS Feed">📡 RSS</span>
      <span title="Sitemap">🗺️ Sitemap</span>
      <span title="Custom scraper">🤖 Scraper</span>
      <span className="ml-4 font-medium">Health:</span>
      <span className="text-emerald-400">🟢 Healthy</span>
      <span className="text-amber-400">🟡 Warning (low yield or minor errors)</span>
      <span className="text-red-400">🔴 Errors (&gt;30% fail rate)</span>
      <span className="text-neutral-500">⚪ Inactive (&gt;7d since last run)</span>
    </div>
  );
}

export function CategoryFilter({
  value,
  onChange,
  categories,
}: Readonly<{
  value: string;
  onChange: (v: string) => void;
  categories: string[];
}>) {
  return (
    <div>
      <label htmlFor="filterCategory" className="block text-xs text-neutral-400 mb-1">
        Category
      </label>
      <select
        id="filterCategory"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-white"
      >
        <option value="all">All categories</option>
        {categories.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
      </select>
    </div>
  );
}

export function TierFilter({
  value,
  onChange,
}: Readonly<{
  value: FilterTier;
  onChange: (v: FilterTier) => void;
}>) {
  return (
    <div>
      <label htmlFor="filterTier" className="block text-xs text-neutral-400 mb-1">
        Tier
      </label>
      <select
        id="filterTier"
        value={value}
        onChange={(e) => onChange(e.target.value as FilterTier)}
        className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-white"
      >
        <option value="all">All tiers</option>
        <option value="standard">Standard</option>
        <option value="premium">Premium</option>
      </select>
    </div>
  );
}

export function StatusFilter({
  value,
  onChange,
}: Readonly<{
  value: FilterEnabled;
  onChange: (v: FilterEnabled) => void;
}>) {
  return (
    <div>
      <label htmlFor="filterStatus" className="block text-xs text-neutral-400 mb-1">
        Status
      </label>
      <select
        id="filterStatus"
        value={value}
        onChange={(e) => onChange(e.target.value as FilterEnabled)}
        className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-white"
      >
        <option value="all">All</option>
        <option value="true">Enabled</option>
        <option value="false">Disabled</option>
      </select>
    </div>
  );
}

export function HealthFilter({
  value,
  onChange,
}: Readonly<{
  value: FilterHealth;
  onChange: (v: FilterHealth) => void;
}>) {
  return (
    <div>
      <label htmlFor="filterHealth" className="block text-xs text-neutral-400 mb-1">
        Health
      </label>
      <select
        id="filterHealth"
        value={value}
        onChange={(e) => onChange(e.target.value as FilterHealth)}
        className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-white"
      >
        <option value="all">All health</option>
        <option value="healthy">🟢 Healthy</option>
        <option value="warning">🟡 Warning</option>
        <option value="error">🔴 Errors</option>
        <option value="inactive">⚪ Inactive</option>
      </select>
    </div>
  );
}
