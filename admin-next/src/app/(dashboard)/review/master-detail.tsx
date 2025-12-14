'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { formatDateTime, getStatusColor, truncate } from '@/lib/utils';
import { DetailPanel } from './detail-panel';
import { bulkApproveAction, bulkRejectAction, bulkReenrichAction } from './actions';
import type { TaxonomyConfig, TaxonomyData } from '@/components/tags';

interface QueueItem {
  id: string;
  url: string;
  status: string;
  payload: {
    title?: string;
    summary?: { short?: string };
    rejection_reason?: string;
    source_slug?: string;
    published_at?: string;
    industry_codes?: string[];
    geography_codes?: string[];
    audience_scores?: {
      executive?: number;
      functional_specialist?: number;
      engineer?: number;
      researcher?: number;
    };
  };
  discovered_at: string;
}

// Get primary audience from scores
function getPrimaryAudience(scores?: QueueItem['payload']['audience_scores']): string | null {
  if (!scores) return null;
  const entries = Object.entries(scores).filter(([, v]) => v && v >= 0.5);
  if (entries.length === 0) return null;
  entries.sort((a, b) => (b[1] || 0) - (a[1] || 0));
  return entries[0][0];
}

interface MasterDetailViewProps {
  items: QueueItem[];
  status: string;
  taxonomyConfig: TaxonomyConfig[];
  taxonomyData: TaxonomyData;
}

export function MasterDetailView({
  items,
  status: _status,
  taxonomyConfig,
  taxonomyData,
}: MasterDetailViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id || null);
  const [listItems, setListItems] = useState(items);
  const router = useRouter();

  // KB-232: Get audience label from taxonomyData (kb_audience) instead of hardcoded map
  const getAudienceLabel = (audienceCode: string): string => {
    // Find the audience config that matches this code
    const config = taxonomyConfig.find(
      (c) => c.behavior_type === 'scoring' && c.payload_field === `audience_scores.${audienceCode}`,
    );
    if (config) {
      const lookupData = taxonomyData[config.slug];
      if (lookupData) {
        const match = lookupData.find((item) => item.code === audienceCode);
        if (match) return match.name;
      }
    }
    // Fallback to capitalized code
    return audienceCode.charAt(0).toUpperCase() + audienceCode.slice(1).replace('_', ' ');
  };

  // Sync items from props when they change (e.g., status filter changed)
  useEffect(() => {
    setListItems(items);
    setSelectedId(items[0]?.id || null);
  }, [items]);

  const selectedIndex = listItems.findIndex((item) => item.id === selectedId);

  const handleNavigate = useCallback(
    (direction: 'prev' | 'next') => {
      if (direction === 'prev' && selectedIndex > 0) {
        setSelectedId(listItems[selectedIndex - 1].id);
      } else if (direction === 'next' && selectedIndex < listItems.length - 1) {
        setSelectedId(listItems[selectedIndex + 1].id);
      }
    },
    [selectedIndex, listItems],
  );

  const handleAction = useCallback(
    async (action: 'approve' | 'reject' | 'reenrich', itemId: string) => {
      let result;

      if (action === 'approve') {
        result = await bulkApproveAction([itemId]);
      } else if (action === 'reject') {
        const reason = prompt('Rejection reason:');
        if (!reason) return;
        result = await bulkRejectAction([itemId], reason);
      } else {
        result = await bulkReenrichAction([itemId]);
      }

      if (result.success) {
        // Remove item from list and select next
        const currentIndex = listItems.findIndex((item) => item.id === itemId);
        const newItems = listItems.filter((item) => item.id !== itemId);
        setListItems(newItems);

        // Select next item or previous if at end
        if (newItems.length > 0) {
          const nextIndex = Math.min(currentIndex, newItems.length - 1);
          setSelectedId(newItems[nextIndex].id);
        } else {
          setSelectedId(null);
        }

        router.refresh();
      }
    },
    [listItems, router],
  );

  const handleClose = useCallback(() => {
    setSelectedId(null);
  }, []);

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-4">
      {/* Left: Item List */}
      <div className="w-1/2 flex flex-col rounded-xl border border-neutral-800 bg-neutral-900/60 overflow-hidden">
        <div className="flex-shrink-0 border-b border-neutral-800 px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-medium text-neutral-300">{listItems.length} items</span>
          <span className="text-xs text-neutral-500">Click to select • ↑↓ to navigate</span>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-neutral-800/50">
          {listItems.length === 0 ? (
            <div className="p-8 text-center text-neutral-500">No items found</div>
          ) : (
            listItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`w-full text-left p-3 transition-colors ${
                  selectedId === item.id
                    ? 'bg-sky-600/20 border-l-2 border-sky-500'
                    : 'hover:bg-neutral-800/50 border-l-2 border-transparent'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {/* Title */}
                    <p className="font-medium text-sm text-white truncate">
                      {item.payload?.title || truncate(item.url, 50)}
                    </p>
                    {/* Date */}
                    {item.payload?.published_at && (
                      <p className="text-[10px] text-neutral-400 mt-0.5">
                        {new Date(item.payload.published_at).toLocaleDateString('en-GB', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    )}
                    {/* URL shown on hover via title attr */}
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${getStatusColor(item.status)}`}
                      >
                        {item.status}
                      </span>
                      {item.payload?.source_slug && (
                        <span className="text-[10px] text-neutral-500">
                          {item.payload.source_slug}
                        </span>
                      )}
                    </div>
                    {/* Industry/Geography chips */}
                    {((item.payload?.industry_codes || []).length > 0 ||
                      (item.payload?.geography_codes || []).length > 0) && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {(item.payload?.industry_codes || []).slice(0, 2).map((code) => (
                          <span
                            key={code}
                            className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px]"
                          >
                            {code.split('-').pop()}
                          </span>
                        ))}
                        {(item.payload?.geography_codes || []).slice(0, 2).map((code) => (
                          <span
                            key={code}
                            className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-300 text-[10px]"
                          >
                            {code}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <span className="text-[10px] text-neutral-500 block">
                      {formatDateTime(item.discovered_at).split(',')[0]}
                    </span>
                    {getPrimaryAudience(item.payload?.audience_scores) && (
                      <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px]">
                        {getAudienceLabel(getPrimaryAudience(item.payload?.audience_scores)!)}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right: Detail Panel */}
      <div className="w-1/2 rounded-xl border border-neutral-800 bg-neutral-900/60 overflow-hidden">
        <DetailPanel
          itemId={selectedId}
          onClose={handleClose}
          onAction={handleAction}
          onNavigate={handleNavigate}
          canNavigatePrev={selectedIndex > 0}
          canNavigateNext={selectedIndex < listItems.length - 1}
          taxonomyConfig={taxonomyConfig}
          taxonomyData={taxonomyData}
        />
      </div>
    </div>
  );
}
