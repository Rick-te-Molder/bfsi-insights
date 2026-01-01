'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Source } from '@/types/database';
import { SourceModal } from './components/SourceModal';
import { SourceTable } from './components/SourceTable';
import type {
  FilterCategory,
  FilterTier,
  FilterEnabled,
  FilterHealth,
  SourceHealth,
} from './types';
import {
  getDiscoveryInfo,
  getHealthBadge,
  getCategoryColor,
  createFormatTimeAgo,
  calculateStats,
} from './utils';

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [healthData, setHealthData] = useState<Map<string, SourceHealth>>(new Map());
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');
  const [filterTier, setFilterTier] = useState<FilterTier>('all');
  const [filterEnabled, setFilterEnabled] = useState<FilterEnabled>('all');
  const [filterHealth, setFilterHealth] = useState<FilterHealth>('all');
  const [editingSource, setEditingSource] = useState<Source | null>(null);
  const [showModal, setShowModal] = useState(false);

  const supabase = createClient();

  const loadSources = useCallback(
    async function loadSources() {
      setLoading(true);
      const { data, error } = await supabase
        .from('kb_source')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('Error loading sources:', error);
      } else {
        setSources(data || []);
      }
      setLoading(false);
    },
    [supabase],
  );

  const loadHealth = useCallback(async function loadHealth() {
    try {
      const res = await fetch('/api/source-health');
      if (res.ok) {
        const data = await res.json();
        const healthMap = new Map<string, SourceHealth>();
        for (const h of data.health || []) {
          healthMap.set(h.source_slug, h);
        }
        setHealthData(healthMap);
      }
    } catch (error) {
      console.error('Error loading health:', error);
    }
  }, []);

  useEffect(() => {
    loadSources();
    loadHealth();
  }, [loadSources, loadHealth]);

  async function toggleEnabled(source: Source) {
    const { error } = await supabase
      .from('kb_source')
      .update({ enabled: !source.enabled })
      .eq('slug', source.slug);

    if (error) {
      alert('Failed to update: ' + error.message);
    } else {
      loadSources();
    }
  }

  const filteredSources = sources.filter((s) => {
    if (filterCategory !== 'all' && s.category !== filterCategory) return false;
    if (filterTier !== 'all' && s.tier !== filterTier) return false;
    if (filterEnabled !== 'all' && String(s.enabled) !== filterEnabled) return false;
    if (filterHealth !== 'all') {
      const health = healthData.get(s.slug);
      const status = health?.health_status || 'inactive';
      if (status !== filterHealth) return false;
    }
    return true;
  });

  const categories = [...new Set(sources.map((s) => s.category).filter(Boolean))];
  const stats = calculateStats(sources);

  // eslint-disable-next-line react-hooks/purity -- Date.now() is intentionally computed once on mount for relative time display
  const now = useMemo(() => Date.now(), []);
  const formatTimeAgo = useCallback(createFormatTimeAgo(now), [now]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-neutral-400">Loading sources...</div>
      </div>
    );
  }

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Sources</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Configure discovery sources and priorities
          </p>
        </div>
        <button
          onClick={() => {
            setEditingSource(null);
            setShowModal(true);
          }}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
        >
          + Add Source
        </button>
      </header>

      <div className="mb-6 flex flex-wrap gap-3 text-sm">
        <span className="rounded-full bg-neutral-800 px-3 py-1">{stats.total} total</span>
        <span className="rounded-full bg-emerald-500/20 text-emerald-300 px-3 py-1">
          {stats.enabled} enabled
        </span>
        <span className="rounded-full bg-amber-500/20 text-amber-300 px-3 py-1">
          {stats.premium} premium
        </span>
        <span className="rounded-full bg-sky-500/20 text-sky-300 px-3 py-1">
          {stats.withRss} RSS
        </span>
        <span className="rounded-full bg-purple-500/20 text-purple-300 px-3 py-1">
          {stats.withScraper} scrapers
        </span>
      </div>

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

      <div className="mb-6 flex flex-wrap gap-4 rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
        <div>
          <label className="block text-xs text-neutral-400 mb-1">Category</label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
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
        <div>
          <label className="block text-xs text-neutral-400 mb-1">Tier</label>
          <select
            value={filterTier}
            onChange={(e) => setFilterTier(e.target.value as FilterTier)}
            className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-white"
          >
            <option value="all">All tiers</option>
            <option value="standard">Standard</option>
            <option value="premium">Premium</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-neutral-400 mb-1">Status</label>
          <select
            value={filterEnabled}
            onChange={(e) => setFilterEnabled(e.target.value as FilterEnabled)}
            className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-white"
          >
            <option value="all">All</option>
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-neutral-400 mb-1">Health</label>
          <select
            value={filterHealth}
            onChange={(e) => setFilterHealth(e.target.value as FilterHealth)}
            className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-white"
          >
            <option value="all">All health</option>
            <option value="healthy">🟢 Healthy</option>
            <option value="warning">🟡 Warning</option>
            <option value="error">🔴 Errors</option>
            <option value="inactive">⚪ Inactive</option>
          </select>
        </div>
      </div>

      <SourceTable
        sources={filteredSources}
        healthData={healthData}
        onToggleEnabled={toggleEnabled}
        onEdit={(source) => {
          setEditingSource(source);
          setShowModal(true);
        }}
        formatTimeAgo={formatTimeAgo}
        getHealthBadge={getHealthBadge}
        getDiscoveryInfo={getDiscoveryInfo}
        getCategoryColor={getCategoryColor}
      />

      {showModal && (
        <SourceModal
          source={editingSource}
          onClose={() => {
            setShowModal(false);
            setEditingSource(null);
          }}
          onSave={() => {
            setShowModal(false);
            setEditingSource(null);
            loadSources();
          }}
        />
      )}
    </div>
  );
}
