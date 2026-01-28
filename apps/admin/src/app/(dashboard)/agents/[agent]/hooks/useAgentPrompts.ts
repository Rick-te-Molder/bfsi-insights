import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { PromptVersion } from '@/types/database';

function sortPromptsByVersion(prompts: PromptVersion[]) {
  return prompts.sort((a, b) => b.version.localeCompare(a.version));
}

function findCurrentPrompt(prompts: PromptVersion[]) {
  return prompts.find((p) => p.stage === 'PRD');
}

function updatePromptState(
  data: PromptVersion[] | null,
  setPrompts: (prompts: PromptVersion[]) => void,
  setSelectedVersion: (version: PromptVersion | null) => void,
  selectedVersion: PromptVersion | null,
) {
  const sorted = sortPromptsByVersion(data || []);
  setPrompts(sorted);
  const current = findCurrentPrompt(sorted);
  if (current && !selectedVersion) {
    setSelectedVersion(current);
  }
}

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
      updatePromptState(data, setPrompts, setSelectedVersion, selectedVersion);
    }
    setLoading(false);
  }, [supabase, agentName, selectedVersion]);

  useEffect(() => {
    loadPrompts();
  }, [loadPrompts]);

  const currentPrompt = findCurrentPrompt(prompts);

  return { prompts, loading, selectedVersion, setSelectedVersion, currentPrompt, loadPrompts };
}
