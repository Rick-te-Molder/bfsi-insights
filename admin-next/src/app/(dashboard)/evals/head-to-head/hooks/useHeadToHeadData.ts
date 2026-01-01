import { useState, useEffect, useCallback } from 'react';
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

export function useHeadToHeadData() {
  const [prompts, setPrompts] = useState<PromptVersion[]>([]);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [statuses, setStatuses] = useState<StatusOption[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const loadData = useCallback(async () => {
    setLoading(true);

    const [promptsRes, itemsRes, statusRes] = await Promise.all([
      supabase.from('prompt_version').select('id, agent_name, version, stage').order('agent_name'),
      supabase
        .from('ingestion_queue')
        .select('id, url, payload, discovered_at, status_code')
        .order('discovered_at', { ascending: false })
        .limit(500),
      supabase.from('status_lookup').select('code, name').order('sort_order'),
    ]);

    if (!promptsRes.error) setPrompts(promptsRes.data || []);
    if (!itemsRes.error) {
      setItems(itemsRes.data || []);
    } else {
      console.error('Failed to load items:', itemsRes.error);
    }
    if (!statusRes.error) setStatuses(statusRes.data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return { prompts, items, statuses, loading };
}
