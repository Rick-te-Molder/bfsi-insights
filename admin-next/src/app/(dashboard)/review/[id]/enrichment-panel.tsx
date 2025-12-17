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
}

interface CurrentPrompt {
  id: string;
  version: string;
  agent_name: string;
}

interface EnrichmentPanelProps {
  item: QueueItem;
  currentPrompts: CurrentPrompt[];
}

const STEP_CONFIG = [
  { key: 'summarize', label: 'Summarize', agent: 'summarizer', statusCode: 210 },
  { key: 'tag', label: 'Tag', agent: 'tagger', statusCode: 220 },
  { key: 'thumbnail', label: 'Thumbnail', agent: 'thumbnail-generator', statusCode: 230 },
] as const;

export function EnrichmentPanel({ item, currentPrompts }: EnrichmentPanelProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const enrichmentMeta = (item.payload?.enrichment_meta || {}) as Record<string, EnrichmentMeta>;

  const getCurrentPrompt = (agentName: string) =>
    currentPrompts.find((p) => p.agent_name === agentName);

  const isUpToDate = (stepKey: string, agentName: string) => {
    const meta = enrichmentMeta[stepKey];
    const current = getCurrentPrompt(agentName);
    if (!meta?.prompt_version_id || !current) return false;
    return meta.prompt_version_id === current.id;
  };

  const hasAnyOutdated = STEP_CONFIG.some(
    ({ key, agent }) => enrichmentMeta[key] && !isUpToDate(key, agent),
  );

  const triggerStep = async (stepKey: string, statusCode: number) => {
    setLoading(stepKey);

    try {
      // Fetch current item to get payload
      const { data: currentItem } = await supabase
        .from('ingestion_queue')
        .select('payload, status_code')
        .eq('id', item.id)
        .single();

      // Determine return status:
      // - If published (400), return to pending_review (300) for re-approval
      // - Otherwise, return to enriched (240)
      const isPublished = currentItem?.status_code === 400;
      const returnStatus = isPublished ? 300 : 240;

      // Cancel any running pipeline
      await supabase
        .from('pipeline_run')
        .update({ status: 'cancelled', completed_at: new Date().toISOString() })
        .eq('queue_id', item.id)
        .eq('status', 'running');

      // Create new pipeline run
      const { data: newRun } = await supabase
        .from('pipeline_run')
        .insert({
          queue_id: item.id,
          trigger: `re-${stepKey}`,
          status: 'running',
          created_by: 'system',
        })
        .select('id')
        .single();

      // Update status and set return_status in payload for single-step return
      const { error } = await supabase
        .from('ingestion_queue')
        .update({
          status_code: statusCode,
          current_run_id: newRun?.id || null,
          payload: {
            ...currentItem?.payload,
            _return_status: returnStatus,
            _single_step: stepKey,
          },
        })
        .eq('id', item.id);

      if (error) throw error;

      router.refresh();
    } catch (err) {
      alert(
        `Failed to trigger ${stepKey}: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
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

      router.refresh();
    } catch (err) {
      alert(
        `Failed to trigger enrichment: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
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

      <div className="space-y-3">
        {STEP_CONFIG.map(({ key, label, agent, statusCode }) => {
          const meta = enrichmentMeta[key];
          const current = getCurrentPrompt(agent);
          const upToDate = isUpToDate(key, agent);
          const hasRun = !!meta?.prompt_version;

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
                  {hasRun ? (
                    <>
                      {meta.prompt_version}
                      {!upToDate && current && (
                        <span className="text-amber-400"> → {current.version}</span>
                      )}
                      <span className="text-neutral-600"> · {formatDate(meta.processed_at)}</span>
                    </>
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
