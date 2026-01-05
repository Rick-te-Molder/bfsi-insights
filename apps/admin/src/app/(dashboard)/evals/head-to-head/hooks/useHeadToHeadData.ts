import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface PromptVersion {
  id: string;
  agent_name: string;
  version: string;
  stage: string;
}

interface QueueItem {
  id: string;
  url: string;
  payload: {
    title?: string;
    source_name?: string;
  };
  discovered_at: string;
  status_code: number;
}

interface StatusOption {
  code: number;
  name: string;
}

/** Fetch prompt versions from database */
function fetchPrompts(supabase: ReturnType<typeof createClient>) {
  return supabase
    .from('prompt_version')
    .select('id, agent_name, version, stage')
    .order('agent_name');
}

/** Fetch queue items from database */
function fetchQueueItems(supabase: ReturnType<typeof createClient>) {
  return supabase
    .from('ingestion_queue')
    .select('id, url, payload, discovered_at, status_code')
    .order('discovered_at', { ascending: false })
    .limit(500);
}

/** Fetch status options from database */
function fetchStatuses(supabase: ReturnType<typeof createClient>) {
  return supabase.from('status_lookup').select('code, name').order('sort_order');
}

interface HeadToHeadState {
  prompts: PromptVersion[];
  items: QueueItem[];
  statuses: StatusOption[];
}

/** Load all data for head-to-head comparison */
async function loadHeadToHeadData(
  supabase: ReturnType<typeof createClient>,
): Promise<HeadToHeadState> {
  const [promptsRes, itemsRes, statusRes] = await Promise.all([
    fetchPrompts(supabase),
    fetchQueueItems(supabase),
    fetchStatuses(supabase),
  ]);

  if (itemsRes.error) console.error('Failed to load items:', itemsRes.error);

  return {
    prompts: promptsRes.data || [],
    items: itemsRes.error ? [] : itemsRes.data || [],
    statuses: statusRes.data || [],
  };
}

export function useHeadToHeadData() {
  const [state, setState] = useState<HeadToHeadState>({ prompts: [], items: [], statuses: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    loadHeadToHeadData(supabase).then((data) => {
      setState(data);
      setLoading(false);
    });
  }, []);

  return { ...state, loading };
}
