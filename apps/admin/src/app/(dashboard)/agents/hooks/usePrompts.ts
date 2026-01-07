'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { PromptVersion } from '@/types/database';
import type { AgentManifest, PromptsByAgent } from '../types';

async function fetchPromptVersions(supabase: ReturnType<typeof createClient>) {
  let result = await supabase
    .from('prompt_version')
    .select('*')
    .order('agent_name')
    .order('version', { ascending: false });

  if (result.error) {
    console.warn('prompt_version failed, trying prompt_versions:', result.error.message);
    result = await supabase
      .from('prompt_versions')
      .select('*')
      .order('agent_name')
      .order('version', { ascending: false });
  }

  if (result.error) {
    console.error('Error loading prompts:', result.error);
    return [];
  }

  return result.data || [];
}

async function fetchAgentManifest(): Promise<AgentManifest | null> {
  try {
    const manifestRes = await fetch('/api/manifest');
    if (!manifestRes.ok) return null;
    return await manifestRes.json();
  } catch (err) {
    console.warn('Failed to load manifest:', err);
    return null;
  }
}

function groupPromptsByAgent(prompts: PromptVersion[]): PromptsByAgent {
  return prompts.reduce((acc, prompt) => {
    if (!acc[prompt.agent_name]) {
      acc[prompt.agent_name] = [];
    }
    acc[prompt.agent_name].push(prompt);
    return acc;
  }, {} as PromptsByAgent);
}

function uniqueStrings(values: string[]) {
  return values.filter((value, index, self) => self.indexOf(value) === index);
}

function buildAgentsList(promptsByAgent: PromptsByAgent) {
  // Add utility agents (keep in sync with utility-versions.js)
  const utilityAgents = ['thumbnail-generator'];

  // Add orchestrator agents
  const orchestratorAgents = ['orchestrator', 'improver'];

  return uniqueStrings([...Object.keys(promptsByAgent), ...utilityAgents, ...orchestratorAgents]);
}

async function retireCurrentPrdVersion(
  supabase: ReturnType<typeof createClient>,
  agentName: string,
) {
  await supabase
    .from('prompt_version')
    .update({ stage: 'RET', retired_at: new Date().toISOString() })
    .eq('agent_name', agentName)
    .eq('stage', 'PRD');
}

async function promotePromptVersion(
  supabase: ReturnType<typeof createClient>,
  agentName: string,
  version: string,
) {
  return supabase
    .from('prompt_version')
    .update({ stage: 'PRD', deployed_at: new Date().toISOString() })
    .eq('agent_name', agentName)
    .eq('version', version);
}

function buildDerivedState(prompts: PromptVersion[]) {
  const promptsByAgent: PromptsByAgent = groupPromptsByAgent(prompts);
  const agents = buildAgentsList(promptsByAgent);
  return { promptsByAgent, agents };
}

function usePromptLoader(supabase: ReturnType<typeof createClient>) {
  const [prompts, setPrompts] = useState<PromptVersion[]>([]);
  const [manifest, setManifest] = useState<AgentManifest | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);

    const [promptVersions, agentManifest] = await Promise.all([
      fetchPromptVersions(supabase),
      fetchAgentManifest(),
    ]);
    setPrompts(promptVersions);
    setManifest(agentManifest);

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { prompts, manifest, loading, reload };
}

function useRollbackToVersion(supabase: ReturnType<typeof createClient>, reload: () => void) {
  return useCallback(
    async (prompt: PromptVersion): Promise<boolean> => {
      if (!confirm(`Make "${prompt.version}" the current version for ${prompt.agent_name}?`)) {
        return false;
      }

      // Retire current PRD version
      await retireCurrentPrdVersion(supabase, prompt.agent_name);

      // Promote selected version to PRD
      const { error } = await promotePromptVersion(supabase, prompt.agent_name, prompt.version);

      if (error) {
        alert('Failed to rollback: ' + error.message);
        return false;
      }

      reload();
      return true;
    },
    [reload, supabase],
  );
}

export function usePrompts() {
  const supabase = createClient();

  const { prompts, manifest, loading, reload } = usePromptLoader(supabase);
  const { promptsByAgent, agents } = buildDerivedState(prompts);
  const rollbackToVersion = useRollbackToVersion(supabase, reload);

  return {
    prompts,
    promptsByAgent,
    agents,
    manifest,
    loading,
    reload,
    rollbackToVersion,
  };
}
