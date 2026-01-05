'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { MissedDiscovery } from '@bfsi/types';

type QueueRow = { id: string; status_code: number; payload: Record<string, unknown> | null };

type MissedRow = Pick<
  MissedDiscovery,
  | 'id'
  | 'url'
  | 'source_domain'
  | 'submitter_name'
  | 'submitter_audience'
  | 'submitter_channel'
  | 'why_valuable'
  | 'submitter_urgency'
  | 'resolution_status'
  | 'submitted_at'
  | 'existing_source_slug'
  | 'queue_id'
>;

function useSupabaseClient() {
  return useMemo(() => createClient(), []);
}

function extractQueueIds(missedData: MissedRow[]) {
  return missedData.map((item) => item.queue_id).filter((id): id is string => id !== null);
}

function mergeQueueData(missedData: MissedRow[], queueMap: Record<string, QueueRow>) {
  return missedData.map((item) => ({
    ...item,
    ingestion_queue: item.queue_id && queueMap[item.queue_id] ? [queueMap[item.queue_id]] : null,
  }));
}

async function fetchMissed(supabase: ReturnType<typeof createClient>) {
  return supabase
    .from('missed_discovery')
    .select(
      `id, url, source_domain, submitter_name, submitter_audience, submitter_channel,
       why_valuable, submitter_urgency, resolution_status, submitted_at, existing_source_slug,
       queue_id`,
    )
    .order('submitted_at', { ascending: false })
    .limit(100);
}

async function fetchQueueMap(opts: {
  supabase: ReturnType<typeof createClient>;
  queueIds: string[];
}) {
  const { supabase, queueIds } = opts;
  if (queueIds.length === 0) return {};

  const { data: queueData } = await supabase
    .from('ingestion_queue')
    .select('id, status_code, payload')
    .in('id', queueIds);
  if (!queueData) return {};

  return Object.fromEntries(
    queueData.map((q) => [q.id, { id: q.id, status_code: q.status_code, payload: q.payload }]),
  ) as Record<string, QueueRow>;
}

function useMissedItemsState() {
  const [missedItems, setMissedItems] = useState<MissedDiscovery[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  return { missedItems, setMissedItems, loadingList, setLoadingList };
}

function useLoadMissedItems(opts: {
  supabase: ReturnType<typeof createClient>;
  setLoadingList: (value: boolean) => void;
  setMissedItems: (items: MissedDiscovery[]) => void;
}) {
  return useCallback(async () => {
    opts.setLoadingList(true);

    const { data: missedData, error: missedError } = await fetchMissed(opts.supabase);
    if (missedError) {
      console.error('Failed to load missed items:', missedError);
      opts.setLoadingList(false);
      return;
    }

    const queueIds = extractQueueIds((missedData || []) as MissedRow[]);
    const queueMap = await fetchQueueMap({ supabase: opts.supabase, queueIds });
    const merged = mergeQueueData((missedData || []) as MissedRow[], queueMap);

    opts.setMissedItems(merged as unknown as MissedDiscovery[]);
    opts.setLoadingList(false);
  }, [opts]);
}

function useDeleteMissedItem(opts: {
  supabase: ReturnType<typeof createClient>;
  setMissedItems: (updater: (prev: MissedDiscovery[]) => MissedDiscovery[]) => void;
}) {
  return useCallback(
    async (id: string) => {
      if (!confirm('Are you sure you want to delete this article?')) return;
      const { error } = await opts.supabase.from('missed_discovery').delete().eq('id', id);
      if (!error) opts.setMissedItems((prev) => prev.filter((item) => item.id !== id));
    },
    [opts],
  );
}

function useAutoLoad(active: boolean, loadMissedItems: () => Promise<void>) {
  useEffect(() => {
    if (active) loadMissedItems();
  }, [active, loadMissedItems]);
}

export function useMissedItems(opts: { active: boolean }) {
  const supabase = useSupabaseClient();
  const state = useMissedItemsState();
  const loadMissedItems = useLoadMissedItems({
    supabase,
    setLoadingList: state.setLoadingList,
    setMissedItems: state.setMissedItems,
  });
  const deleteItem = useDeleteMissedItem({ supabase, setMissedItems: state.setMissedItems });

  useAutoLoad(opts.active, loadMissedItems);

  return {
    missedItems: state.missedItems,
    loadingList: state.loadingList,
    loadMissedItems,
    deleteItem,
  };
}
