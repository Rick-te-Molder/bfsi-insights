'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Source } from '@/types/database';

interface SourceModalProps {
  source: Source | null;
  onClose: () => void;
  onSave: () => void;
}

export function SourceModal({ source, onClose, onSave }: SourceModalProps) {
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
