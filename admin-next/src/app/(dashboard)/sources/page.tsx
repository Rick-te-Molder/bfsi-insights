'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Source } from '@/types/database';

type FilterCategory = 'all' | string;
type FilterTier = 'all' | 'standard' | 'premium';
type FilterEnabled = 'all' | 'true' | 'false';
type FilterHealth = 'all' | 'healthy' | 'warning' | 'error' | 'inactive';

interface SourceHealth {
  source_slug: string;
  last_discovery: string | null;
  items_7d: number;
  items_30d: number;
  failed_7d: number;
  error_rate: number;
  health_status: 'healthy' | 'warning' | 'error' | 'inactive';
}

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

  // Filter sources
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

  // Get unique categories
  const categories = [...new Set(sources.map((s) => s.category).filter(Boolean))];

  // Stats
  const stats = {
    total: sources.length,
    enabled: sources.filter((s) => s.enabled).length,
    premium: sources.filter((s) => s.tier === 'premium').length,
    withRss: sources.filter((s) => s.rss_feed).length,
    withScraper: sources.filter((s) => s.scraper_config).length,
  };

  function getDiscoveryInfo(source: Source) {
    const methods = [];
    if (source.rss_feed) methods.push({ icon: '📡', label: 'RSS Feed', url: source.rss_feed });
    if (source.sitemap_url) methods.push({ icon: '🗺️', label: 'Sitemap', url: source.sitemap_url });
    if (source.scraper_config) methods.push({ icon: '🤖', label: 'Scraper', url: null });
    return methods;
  }

  function getHealthBadge(health: SourceHealth | undefined) {
    if (!health) {
      return { icon: '⚪', label: 'No data', className: 'text-neutral-500' };
    }
    switch (health.health_status) {
      case 'healthy':
        return { icon: '🟢', label: 'Healthy', className: 'text-emerald-400' };
      case 'warning':
        return { icon: '🟡', label: 'Warning', className: 'text-amber-400' };
      case 'error':
        return { icon: '🔴', label: 'Errors', className: 'text-red-400' };
      case 'inactive':
        return { icon: '⚪', label: 'Inactive', className: 'text-neutral-500' };
      default:
        return { icon: '⚪', label: 'Unknown', className: 'text-neutral-500' };
    }
  }

  function formatTimeAgo(date: string | null): string {
    if (!date) return 'Never';
    const diff = Date.now() - new Date(date).getTime();
    const hours = Math.floor(diff / (60 * 60 * 1000));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
  }

  function getCategoryColor(category: string) {
    const colors: Record<string, string> = {
      regulator: 'bg-red-500/20 text-red-300',
      central_bank: 'bg-amber-500/20 text-amber-300',
      vendor: 'bg-orange-500/20 text-orange-300',
      research: 'bg-pink-500/20 text-pink-300',
      consulting: 'bg-teal-500/20 text-teal-300',
      media_outlet: 'bg-sky-500/20 text-sky-300',
      standards_body: 'bg-purple-500/20 text-purple-300',
      academic: 'bg-indigo-500/20 text-indigo-300',
      government_body: 'bg-slate-500/20 text-slate-300',
    };
    return colors[category] || 'bg-neutral-700 text-neutral-300';
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-neutral-400">Loading sources...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
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

      {/* Stats */}
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

      {/* Legend */}
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

      {/* Filters */}
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

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-neutral-800">
        <table className="w-full">
          <thead className="bg-neutral-900">
            <tr className="text-left text-xs font-medium uppercase tracking-wider text-neutral-400">
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Discovery</th>
              <th className="px-4 py-3">Health</th>
              <th className="px-4 py-3">Last Run</th>
              <th className="px-4 py-3">Items (7d)</th>
              <th className="px-4 py-3">Enabled</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {filteredSources.map((source) => {
              const health = healthData.get(source.slug);
              const healthBadge = getHealthBadge(health);
              const discoveryMethods = getDiscoveryInfo(source);

              return (
                <tr key={source.slug} className="hover:bg-neutral-800/50">
                  {/* Source */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-neutral-700 text-xs font-medium">
                        {source.sort_order ? Math.ceil(source.sort_order / 100) : '-'}
                      </span>
                      <div>
                        <div className="font-medium text-white">{source.name}</div>
                        <div className="text-xs text-neutral-500">{source.domain}</div>
                      </div>
                    </div>
                    {source.disabled_reason && (
                      <div className="text-xs text-red-400 mt-1 ml-8">
                        ⚠️ {source.disabled_reason}
                      </div>
                    )}
                  </td>

                  {/* Category */}
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${getCategoryColor(source.category)}`}
                    >
                      {source.category || '-'}
                    </span>
                    {source.tier === 'premium' && (
                      <span className="ml-1 text-xs text-amber-400">★</span>
                    )}
                  </td>

                  {/* Discovery */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {discoveryMethods.length > 0 ? (
                        discoveryMethods.map((method, i) => (
                          <span
                            key={i}
                            title={`${method.label}${method.url ? `: ${method.url}` : ''}`}
                            className="cursor-help"
                          >
                            {method.icon}
                          </span>
                        ))
                      ) : (
                        <span className="text-neutral-600" title="No discovery configured">
                          ❌
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Health */}
                  <td className="px-4 py-3">
                    <span
                      className={`text-sm ${healthBadge.className}`}
                      title={`${healthBadge.label}${health ? ` (${health.error_rate}% errors)` : ''}`}
                    >
                      {healthBadge.icon}
                    </span>
                  </td>

                  {/* Last Run */}
                  <td className="px-4 py-3">
                    <span className="text-xs text-neutral-400">
                      {formatTimeAgo(health?.last_discovery || null)}
                    </span>
                  </td>

                  {/* Items */}
                  <td className="px-4 py-3">
                    <span
                      className={`text-sm ${health?.items_7d ? 'text-white' : 'text-neutral-600'}`}
                    >
                      {health?.items_7d || 0}
                    </span>
                    {health?.failed_7d ? (
                      <span className="text-xs text-red-400 ml-1">({health.failed_7d} failed)</span>
                    ) : null}
                  </td>

                  {/* Enabled */}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleEnabled(source)}
                      className={`w-10 h-5 rounded-full transition-colors ${
                        source.enabled ? 'bg-emerald-500' : 'bg-neutral-700'
                      }`}
                    >
                      <span
                        className={`block w-4 h-4 rounded-full bg-white transform transition-transform ${
                          source.enabled ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => {
                        setEditingSource(source);
                        setShowModal(true);
                      }}
                      className="text-sky-400 hover:text-sky-300 text-xs"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal */}
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

interface SourceModalProps {
  source: Source | null;
  onClose: () => void;
  onSave: () => void;
}

function SourceModal({ source, onClose, onSave }: SourceModalProps) {
  const [formData, setFormData] = useState<Partial<Source>>(
    source || {
      name: '',
      slug: '',
      domain: '',
      category: 'vendor',
      tier: 'standard',
      enabled: true,
      sort_order: 500,
      rss_feed: '',
      sitemap_url: '',
      description: '',
      show_on_external_page: false,
    },
  );
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const dataToSave = {
      ...formData,
      rss_feed: formData.rss_feed || null,
      sitemap_url: formData.sitemap_url || null,
      description: formData.description || null,
    };

    let error;
    if (source) {
      const { error: updateError } = await supabase
        .from('kb_source')
        .update(dataToSave)
        .eq('slug', source.slug);
      error = updateError;
    } else {
      const { error: insertError } = await supabase.from('kb_source').insert(dataToSave);
      error = insertError;
    }

    setSaving(false);

    if (error) {
      alert('Failed to save: ' + error.message);
    } else {
      onSave();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-neutral-800 bg-neutral-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-white mb-4">
          {source ? 'Edit Source' : 'Add Source'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Name</label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Slug</label>
              <input
                type="text"
                value={formData.slug || ''}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-white"
                required
                disabled={!!source}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-neutral-400 mb-1">Domain</label>
            <input
              type="text"
              value={formData.domain || ''}
              onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
              className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-white"
              placeholder="example.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Category</label>
              <select
                value={formData.category || ''}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-white"
              >
                <option value="regulator">Regulator</option>
                <option value="central_bank">Central Bank</option>
                <option value="vendor">Vendor</option>
                <option value="research">Research</option>
                <option value="consulting">Consulting</option>
                <option value="media_outlet">Media Outlet</option>
                <option value="standards_body">Standards Body</option>
                <option value="academic">Academic</option>
                <option value="government_body">Government Body</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Tier</label>
              <select
                value={formData.tier || 'standard'}
                onChange={(e) =>
                  setFormData({ ...formData, tier: e.target.value as 'standard' | 'premium' })
                }
                className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-white"
              >
                <option value="standard">Standard</option>
                <option value="premium">Premium</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-neutral-400 mb-1">RSS Feed URL</label>
            <input
              type="text"
              value={formData.rss_feed || ''}
              onChange={(e) => setFormData({ ...formData, rss_feed: e.target.value })}
              className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-white"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="block text-sm text-neutral-400 mb-1">Sitemap URL</label>
            <input
              type="text"
              value={formData.sitemap_url || ''}
              onChange={(e) => setFormData({ ...formData, sitemap_url: e.target.value })}
              className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-white"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="block text-sm text-neutral-400 mb-1">Priority (sort order)</label>
            <input
              type="number"
              value={formData.sort_order || 500}
              onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) })}
              className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-white"
            />
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-neutral-400">
              <input
                type="checkbox"
                checked={formData.enabled || false}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                className="rounded border-neutral-700 bg-neutral-800"
              />
              Enabled
            </label>
            <label className="flex items-center gap-2 text-sm text-neutral-400">
              <input
                type="checkbox"
                checked={formData.show_on_external_page || false}
                onChange={(e) =>
                  setFormData({ ...formData, show_on_external_page: e.target.checked })
                }
                className="rounded border-neutral-700 bg-neutral-800"
              />
              Show on external page
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm text-neutral-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
