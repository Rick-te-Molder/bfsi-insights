'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { QueueItem } from '@bfsi/types';

interface EnrichmentMeta {
  prompt_version_id?: string;
  prompt_version?: string;
  llm_model?: string;
  processed_at?: string;
  agent_type?: 'utility' | 'llm';
  implementation_version?: string;
  method?: string;
}

interface CurrentPrompt {
  id: string;
  version: string;
  agent_name: string;
}

interface UtilityVersion {
  agent_name: string;
  version: string;
}

interface EnrichmentPanelProps {
  item: QueueItem;
  currentPrompts: CurrentPrompt[];
  utilityVersions?: UtilityVersion[];
}

const STEP_CONFIG = [
  { key: 'summarize', label: 'Summarize', agent: 'summarizer', statusCode: 210 },
  { key: 'tag', label: 'Tag', agent: 'tagger', statusCode: 220 },
  { key: 'thumbnail', label: 'Thumbnail', agent: 'thumbnail-generator', statusCode: 230 },
] as const;

// Check if step has output data in payload (for legacy items without enrichment_meta)
function hasStepOutput(payload: QueueItem['payload'], stepKey: string): boolean {
  if (!payload) return false;
  switch (stepKey) {
    case 'summarize':
      return !!(payload.summary || payload.title);
    case 'tag':
      return !!(payload.industry_codes?.length || payload.topic_codes?.length);
    case 'thumbnail':
      return !!(payload.thumbnail_url || payload.thumbnail);
    default:
      return false;
  }
}

export function EnrichmentPanel({
  item,
  currentPrompts,
  utilityVersions = [],
}: EnrichmentPanelProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const enrichmentMeta = (item.payload?.enrichment_meta || {}) as Record<string, EnrichmentMeta>;

  const getCurrentPrompt = (agentName: string) =>
    currentPrompts.find((p) => p.agent_name === agentName);

  const getCurrentUtilityVersion = (agentName: string) =>
    utilityVersions.find((v) => v.agent_name === agentName);

  const isUpToDate = (stepKey: string, agentName: string) => {
    const meta = enrichmentMeta[stepKey];

    // Utility agents: compare implementation versions
    if (meta?.agent_type === 'utility') {
      const currentVersion = getCurrentUtilityVersion(agentName);
      if (!currentVersion || !meta.implementation_version) return false;
      return meta.implementation_version === currentVersion.version;
    }

    // LLM agents: compare prompt versions
    const current = getCurrentPrompt(agentName);
    if (!meta?.prompt_version_id || !current) return false;
    return meta.prompt_version_id === current.id;
  };

  // Legacy items (with output but no meta) are considered outdated since we don't know their version
  const hasAnyOutdated = STEP_CONFIG.some(({ key, agent }) => {
    const hasMeta = !!enrichmentMeta[key];
    const hasLegacy = hasStepOutput(item.payload, key);
    if (hasMeta) return !isUpToDate(key, agent);
    if (hasLegacy) return true; // Legacy = outdated (unknown version)
    return false;
  });

  const triggerStep = async (stepKey: string, _statusCode: number) => {
    setLoading(stepKey);

    try {
      setMessage({ type: 'success', text: `✓ Processing ${stepKey}...` });

      // KB-285: All pipeline_run operations moved to server-side API route
      // to use service role (bypasses RLS restrictions)
      const enrichRes = await fetch('/api/enrich-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: stepKey, id: item.id }),
      });

      if (!enrichRes.ok) {
        const errData = await enrichRes.json().catch(() => ({}));
        throw new Error(errData.error || `Agent API error: ${enrichRes.status}`);
      }

      const result = await enrichRes.json();
      setMessage({
        type: 'success',
        text: `✓ ${stepKey} complete${result.processed ? ` (${result.processed} processed)` : ''}`,
      });
      setTimeout(() => setMessage(null), 5000);
      router.refresh();
    } catch (err) {
      setMessage({
        type: 'error',
        text: `Failed: ${err instanceof Error ? err.message : 'Unknown'}`,
      });
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setLoading(null);
    }
  };

  const triggerEnrichAll = async () => {
    setLoading('enrich');

    try {
      // Fetch current item to check if published
      const { data: currentItem } = await supabase
        .from('ingestion_queue')
        .select('payload, status_code')
        .eq('id', item.id)
        .single();

      // If published, set return status to pending_review for re-approval
      const isPublished = currentItem?.status_code === 400;

      await supabase
        .from('pipeline_run')
        .update({ status: 'cancelled', completed_at: new Date().toISOString() })
        .eq('queue_id', item.id)
        .eq('status', 'running');

      const { data: newRun } = await supabase
        .from('pipeline_run')
        .insert({
          queue_id: item.id,
          trigger: 're-enrich',
          status: 'running',
          created_by: 'system',
        })
        .select('id')
        .single();

      // For full re-enrich, clear single-step flags but keep return status for published
      const updatedPayload = {
        ...currentItem?.payload,
        _single_step: null,
        _return_status: isPublished ? 300 : null, // Return to pending_review if published
      };

      const { error } = await supabase
        .from('ingestion_queue')
        .update({
          status_code: 200, // PENDING_ENRICHMENT
          current_run_id: newRun?.id || null,
          payload: updatedPayload,
        })
        .eq('id', item.id);

      if (error) throw error;

      setMessage({ type: 'success', text: '✓ Queued full re-enrichment (status → 200)' });
      setTimeout(() => setMessage(null), 5000);
      router.refresh();
    } catch (err) {
      setMessage({
        type: 'error',
        text: `Failed: ${err instanceof Error ? err.message : 'Unknown'}`,
      });
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setLoading(null);
    }
  };

  const formatDate = (iso?: string) => {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-4">
        Enrichment
      </h3>

      {/* Status message */}
      {message && (
        <div
          className={`mb-3 px-3 py-2 rounded-lg text-xs font-medium ${
            message.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Current status indicator */}
      <div className="mb-3 px-2 py-1.5 rounded bg-neutral-800/50 text-xs text-neutral-400">
        Status: <span className="font-mono text-neutral-300">{item.status_code}</span>
      </div>

      <div className="space-y-3">
        {STEP_CONFIG.map(({ key, label, agent, statusCode }) => {
          const meta = enrichmentMeta[key];
          const current = getCurrentPrompt(agent);
          const upToDate = isUpToDate(key, agent);
          const hasMetaRun = !!meta?.prompt_version;
          const hasLegacyOutput = hasStepOutput(item.payload, key);
          const hasRun = hasMetaRun || hasLegacyOutput;
          const isLegacy = !hasMetaRun && hasLegacyOutput;

          return (
            <div key={key} className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-neutral-200">{label}</span>
                  {hasRun && !upToDate && (
                    <span className="text-xs text-amber-400" title="Upgrade available">
                      ⬆️
                    </span>
                  )}
                </div>
                <div className="text-xs text-neutral-500 truncate">
                  {meta?.agent_type === 'utility' ? (
                    <>
                      <span className="text-neutral-400">v{meta.implementation_version}</span>
                      {!upToDate &&
                        (() => {
                          const currentUtilVersion = getCurrentUtilityVersion(agent);
                          return currentUtilVersion ? (
                            <span className="text-amber-400"> → v{currentUtilVersion.version}</span>
                          ) : null;
                        })()}
                      <span className="text-neutral-600"> · {meta.method}</span>
                      <span className="text-neutral-600"> · {formatDate(meta.processed_at)}</span>
                    </>
                  ) : hasMetaRun ? (
                    <>
                      {meta.prompt_version}
                      {!upToDate && current && (
                        <span className="text-amber-400"> → {current.version}</span>
                      )}
                      <span className="text-neutral-600"> · {formatDate(meta.processed_at)}</span>
                    </>
                  ) : isLegacy ? (
                    <span className="text-neutral-500">Legacy (no version info)</span>
                  ) : (
                    <span className="text-neutral-600">Not processed</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => triggerStep(key, statusCode)}
                disabled={loading !== null || upToDate}
                className={`shrink-0 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  upToDate
                    ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed'
                    : 'bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 border border-sky-500/30'
                } disabled:opacity-50`}
              >
                {loading === key ? '...' : hasRun ? 'Re-run' : 'Run'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Re-enrich All button */}
      <div className="mt-4 pt-3 border-t border-neutral-800">
        <button
          onClick={triggerEnrichAll}
          disabled={loading !== null || !hasAnyOutdated}
          className={`w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            hasAnyOutdated
              ? 'bg-sky-600 text-white hover:bg-sky-500'
              : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
          } disabled:opacity-50`}
        >
          {loading === 'enrich' ? 'Queueing...' : '🔄 Re-enrich All Outdated'}
        </button>
        {!hasAnyOutdated && (
          <p className="text-xs text-neutral-500 text-center mt-1">All steps are up to date</p>
        )}
      </div>
    </div>
  );
}
