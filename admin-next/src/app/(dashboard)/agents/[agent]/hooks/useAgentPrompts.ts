import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { PromptVersion } from '@/types/database';

export function useAgentPrompts(agentName: string) {
  const [prompts, setPrompts] = useState<PromptVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState<PromptVersion | null>(null);
  const supabase = createClient();

  const loadPrompts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('prompt_version')
      .select('*')
      .eq('agent_name', agentName);

    if (error) {
      console.error('Error loading prompts:', error);
    } else {
      const sorted = (data || []).sort((a, b) => b.version.localeCompare(a.version));
      setPrompts(sorted);
      const current = sorted.find((p) => p.stage === 'PRD');
      if (current && !selectedVersion) {
        setSelectedVersion(current);
      }
    }
    setLoading(false);
  }, [supabase, agentName, selectedVersion]);

  useEffect(() => {
    loadPrompts();
  }, [loadPrompts]);

  const currentPrompt = prompts.find((p) => p.stage === 'PRD');

  return { prompts, loading, selectedVersion, setSelectedVersion, currentPrompt, loadPrompts };
}
