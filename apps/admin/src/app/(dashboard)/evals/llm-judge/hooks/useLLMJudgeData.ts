import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { EvalRun } from '../components/runs-table';
import type { PromptVersion } from '../components/index';

export function useLLMJudgeData() {
  const [runs, setRuns] = useState<EvalRun[]>([]);
  const [prompts, setPrompts] = useState<PromptVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const loadData = useCallback(async () => {
    setLoading(true);
    const [runsRes, promptsRes] = await Promise.all([
      supabase
        .from('eval_run')
        .select('*')
        .eq('eval_type', 'llm_judge')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('prompt_version').select('id, agent_name, version, stage').order('agent_name'),
    ]);
    if (!runsRes.error) setRuns(runsRes.data || []);
    if (!promptsRes.error) setPrompts(promptsRes.data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return { runs, prompts, loading, loadData };
}
