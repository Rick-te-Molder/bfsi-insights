import { useState, useCallback, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Source } from '@/types/database';
import type { SourceHealth } from '../types';

function useSourceLoader(supabase: ReturnType<typeof createClient>) {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSources = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('kb_source')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) console.error('Error loading sources:', error);
    else setSources(data || []);
    setLoading(false);
  }, [supabase]);

  return { sources, loading, loadSources };
}

function useHealthLoader() {
  const [healthData, setHealthData] = useState<Map<string, SourceHealth>>(new Map());

  const loadHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/source-health');
      if (!res.ok) return;
      const data = await res.json();
      const healthMap = new Map<string, SourceHealth>();
      for (const h of data.health || []) healthMap.set(h.source_slug, h);
      setHealthData(healthMap);
    } catch (error) {
      console.error('Error loading health:', error);
    }
  }, []);

  return { healthData, loadHealth };
}

export function useSourceData() {
  const supabase = createClient();
  const { sources, loading, loadSources } = useSourceLoader(supabase);
  const { healthData, loadHealth } = useHealthLoader();

  useEffect(() => {
    loadSources();
    loadHealth();
  }, [loadSources, loadHealth]);

  const toggleEnabled = useCallback(
    async (source: Source) => {
      const { error } = await supabase
        .from('kb_source')
        .update({ enabled: !source.enabled })
        .eq('slug', source.slug);
      if (error) alert('Failed to update: ' + error.message);
      else loadSources();
    },
    [supabase, loadSources],
  );

  return { sources, healthData, loading, loadSources, toggleEnabled };
}
