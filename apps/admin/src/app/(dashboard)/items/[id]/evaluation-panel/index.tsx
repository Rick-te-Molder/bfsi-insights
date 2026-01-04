'use client';

import { useState } from 'react';
import type { QueueItem } from '@bfsi/types';
import { LogsTab } from './LogsTab';
import { CompareTab } from './CompareTab';
import { RawTab } from './RawTab';

interface EnrichmentLogEntry {
  agent: string;
  timestamp: string;
  duration_ms: number;
  model?: string;
  prompt_version?: string;
  input_tokens?: number;
  output_tokens?: number;
  success: boolean;
  error?: string;
}

const TABS = [
  { id: 'logs', label: 'Enrichment Logs', icon: '📊' },
  { id: 'compare', label: 'Compare', icon: '⚖️' },
  { id: 'raw', label: 'Raw Data', icon: '{ }' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function TabButton({
  tab,
  isActive,
  onClick,
}: Readonly<{ tab: (typeof TABS)[number]; isActive: boolean; onClick: () => void }>) {
  const activeClass = isActive
    ? 'text-sky-400 border-b-2 border-sky-400 -mb-px'
    : 'text-neutral-400 hover:text-white';
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${activeClass}`}
    >
      <span>{tab.icon}</span>
      <span>{tab.label}</span>
    </button>
  );
}

function useEnrichmentData(item: QueueItem) {
  const payload = (item.payload || {}) as Record<string, unknown>;
  const enrichmentLog = (payload.enrichment_log as EnrichmentLogEntry[]) || [];
  const rawContent = (payload.raw_content as string) || '';
  const summary = (payload.summary as { short?: string; medium?: string; long?: string }) || {};
  const totalDuration = enrichmentLog.reduce((sum, e) => sum + (e.duration_ms || 0), 0);
  const totalInputTokens = enrichmentLog.reduce((sum, e) => sum + (e.input_tokens || 0), 0);
  const totalOutputTokens = enrichmentLog.reduce((sum, e) => sum + (e.output_tokens || 0), 0);
  return {
    payload,
    enrichmentLog,
    rawContent,
    summary,
    totalDuration,
    totalInputTokens,
    totalOutputTokens,
    successCount: enrichmentLog.filter((e) => e.success).length,
    failCount: enrichmentLog.filter((e) => !e.success).length,
  };
}

function TabContent({
  activeTab,
  data,
}: Readonly<{ activeTab: TabId; data: ReturnType<typeof useEnrichmentData> }>) {
  if (activeTab === 'logs')
    return (
      <LogsTab
        enrichmentLog={data.enrichmentLog}
        totalDuration={data.totalDuration}
        totalInputTokens={data.totalInputTokens}
        totalOutputTokens={data.totalOutputTokens}
        successCount={data.successCount}
        failCount={data.failCount}
      />
    );
  if (activeTab === 'compare')
    return <CompareTab rawContent={data.rawContent} summary={data.summary} />;
  return <RawTab payload={data.payload} />;
}

export function EvaluationPanel({ item }: Readonly<{ item: QueueItem }>) {
  const [activeTab, setActiveTab] = useState<TabId>('compare');
  const data = useEnrichmentData(item);
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60">
      <div className="flex border-b border-neutral-800">
        {TABS.map((tab) => (
          <TabButton
            key={tab.id}
            tab={tab}
            isActive={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          />
        ))}
      </div>
      <div className="p-6">
        <TabContent activeTab={activeTab} data={data} />
      </div>
    </div>
  );
}
