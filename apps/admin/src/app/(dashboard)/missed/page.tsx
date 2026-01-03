'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MissedForm } from './components/MissedForm';
import { MissedList } from './components/MissedList';
import type { MissedDiscovery } from './types';

export default function MissedDiscoveryPage() {
  const [activeTab, setActiveTab] = useState<'report' | 'list'>('report');
  const [missedItems, setMissedItems] = useState<MissedDiscovery[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const supabase = createClient();

  const loadMissedItems = useCallback(async () => {
    setLoadingList(true);
    const { data, error } = await supabase
      .from('missed_discovery')
      .select(
        'id, url, source_domain, submitter_name, submitter_audience, why_valuable, submitter_urgency, resolution_status, submitted_at, existing_source_slug',
      )
      .order('submitted_at', { ascending: false })
      .limit(100);

    if (!error && data) {
      setMissedItems(data);
    }
    setLoadingList(false);
  }, [supabase]);

  useEffect(() => {
    if (activeTab === 'list') {
      loadMissedItems();
    }
  }, [activeTab, loadMissedItems]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Add Article</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Submit articles we missed — they&apos;ll be processed AND help improve our discovery
        </p>
      </header>

      <div className="flex gap-2 border-b border-neutral-800 pb-2">
        <button
          onClick={() => setActiveTab('report')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            activeTab === 'report'
              ? 'bg-sky-600 text-white'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
        >
          ➕ Report Missed Article
        </button>
        <button
          onClick={() => setActiveTab('list')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            activeTab === 'list'
              ? 'bg-sky-600 text-white'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
        >
          📋 View All ({missedItems.length || '...'})
        </button>
      </div>

      {activeTab === 'report' ? (
        <MissedForm onSuccess={loadMissedItems} />
      ) : (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 overflow-hidden">
          <MissedList items={missedItems} loading={loadingList} />
        </div>
      )}
    </div>
  );
}
