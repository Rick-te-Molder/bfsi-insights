'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { PromptABTest, PromptVersion } from '@/types/database';

export interface AbTestsDataState {
  tests: PromptABTest[];
  prompts: PromptVersion[];
  loading: boolean;
  agents: string[];
  reload: () => Promise<void>;
}

function useSupabaseClient() {
  return useMemo(() => createClient(), []);
}

function useAgents(prompts: PromptVersion[]) {
  return useMemo(() => {
    return [...new Set(prompts.map((p) => p.agent_name))];
  }, [prompts]);
}

function useAbTestsState() {
  const [tests, setTests] = useState<PromptABTest[]>([]);
  const [prompts, setPrompts] = useState<PromptVersion[]>([]);
  const [loading, setLoading] = useState(true);
  return { tests, setTests, prompts, setPrompts, loading, setLoading };
}

function useReloadData(opts: {
  supabase: ReturnType<typeof createClient>;
  setLoading: (value: boolean) => void;
  setTests: (tests: PromptABTest[]) => void;
  setPrompts: (prompts: PromptVersion[]) => void;
}) {
  const { supabase, setLoading, setTests, setPrompts } = opts;

  return useCallback(async () => {
    setLoading(true);

    const [testsRes, promptsRes] = await Promise.all([
      supabase.from('prompt_ab_test').select('*').order('created_at', { ascending: false }),
      supabase.from('prompt_version').select('*').order('agent_name'),
    ]);

    if (!testsRes.error) setTests(testsRes.data || []);
    if (!promptsRes.error) setPrompts(promptsRes.data || []);

    setLoading(false);
  }, [setLoading, setPrompts, setTests, supabase]);
}

export function useAbTestsData(): AbTestsDataState {
  const state = useAbTestsState();
  const supabase = useSupabaseClient();
  const reload = useReloadData({
    supabase,
    setLoading: state.setLoading,
    setTests: state.setTests,
    setPrompts: state.setPrompts,
  });

  useEffect(() => {
    reload();
  }, [reload]);

  const agents = useAgents(state.prompts);

  return {
    tests: state.tests,
    prompts: state.prompts,
    loading: state.loading,
    agents,
    reload,
  };
}
