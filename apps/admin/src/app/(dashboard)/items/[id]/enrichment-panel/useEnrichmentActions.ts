'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { QueueItem } from '@bfsi/types';

type Message = { type: 'success' | 'error'; text: string } | null;
type Supabase = ReturnType<typeof createClient>;

async function callEnrichStep(stepKey: string, itemId: string) {
  const res = await fetch('/api/enrich-step', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ step: stepKey, id: itemId }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Agent API error: ${res.status}`);
  }
  return res.json();
}

async function cancelRunningPipelines(supabase: Supabase, queueId: string) {
  await supabase
    .from('pipeline_run')
    .update({ status: 'cancelled', completed_at: new Date().toISOString() })
    .eq('queue_id', queueId)
    .eq('status', 'running');
}

async function createPipelineRun(supabase: Supabase, queueId: string) {
  const { data } = await supabase
    .from('pipeline_run')
    .insert({ queue_id: queueId, trigger: 're-enrich', status: 'running', created_by: 'system' })
    .select('id')
    .single();
  return data?.id || null;
}

async function queueReEnrichment(supabase: Supabase, item: QueueItem) {
  const { data: currentItem } = await supabase
    .from('ingestion_queue')
    .select('payload, status_code')
    .eq('id', item.id)
    .single();
  const isPublished = currentItem?.status_code === 400;
  await cancelRunningPipelines(supabase, item.id);
  const newRunId = await createPipelineRun(supabase, item.id);
  const updatedPayload = {
    ...currentItem?.payload,
    _single_step: null,
    _return_status: isPublished ? 300 : null,
    _manual_override: true, // Required for state machine to allow re-enrich transitions
  };
  const { error } = await supabase
    .from('ingestion_queue')
    .update({ status_code: 200, current_run_id: newRunId, payload: updatedPayload })
    .eq('id', item.id);
  if (error) throw error;
}

async function triggerImmediateEnrichment(itemId: string) {
  // Trigger immediate processing via the enrich-item API
  const res = await fetch('/api/enrich-item', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: itemId }),
  });
  if (!res.ok) {
    const text = await res.text();
    let errorMsg: string;
    try {
      const errData = JSON.parse(text);
      errorMsg = errData.error || `API error: ${res.status}`;
    } catch {
      errorMsg = text.substring(0, 100) || `API error: ${res.status}`;
    }
    throw new Error(errorMsg);
  }
  return res.json();
}

function useMessageState() {
  const [message, setMessage] = useState<Message>(null);
  const show = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };
  return { message, show };
}

type ShowFn = (type: 'success' | 'error', text: string) => void;
type SetLoadingFn = (val: string | null) => void;

function createTriggerStep(
  item: QueueItem,
  show: ShowFn,
  setLoading: SetLoadingFn,
  refresh: () => void,
) {
  return async (stepKey: string) => {
    setLoading(stepKey);
    try {
      show('success', `✓ Processing ${stepKey}...`);
      const result = await callEnrichStep(stepKey, item.id);
      const processedSuffix = result.processed ? ` (${result.processed} processed)` : '';
      show('success', `✓ ${stepKey} complete${processedSuffix}`);
      refresh();
    } catch (err) {
      show('error', `Failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally {
      setLoading(null);
    }
  };
}

function createTriggerEnrichAll(
  item: QueueItem,
  supabase: Supabase,
  show: ShowFn,
  setLoading: SetLoadingFn,
  refresh: () => void,
) {
  return async () => {
    setLoading('enrich');
    try {
      await queueReEnrichment(supabase, item);
      show('success', '✓ Starting re-enrichment...');
      // Trigger immediate processing instead of waiting for queue
      await triggerImmediateEnrichment(item.id);
      show('success', '✓ Re-enrichment started');
      refresh();
    } catch (err) {
      show('error', `Failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally {
      setLoading(null);
    }
  };
}

export function useEnrichmentActions(item: QueueItem) {
  const [loading, setLoading] = useState<string | null>(null);
  const [_isRefreshing, startTransition] = useTransition();
  const { message, show } = useMessageState();
  const router = useRouter();
  const supabase = createClient();
  const triggerStep = createTriggerStep(item, show, setLoading, () =>
    startTransition(() => router.refresh()),
  );
  const triggerEnrichAll = createTriggerEnrichAll(item, supabase, show, setLoading, () =>
    startTransition(() => router.refresh()),
  );
  return { loading, message, triggerStep, triggerEnrichAll };
}
