'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { PromptVersion } from '@/types/database';
import type { AgentManifest, PromptsByAgent } from '../types';

export function usePrompts() {
  const [prompts, setPrompts] = useState<PromptVersion[]>([]);
  const [manifest, setManifest] = useState<AgentManifest | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const loadPrompts = useCallback(async () => {
    setLoading(true);

    let result = await supabase
      .from('prompt_version')
      .select('*')
      .order('agent_name')
      .order('created_at', { ascending: false });

    if (result.error) {
      console.warn('prompt_version failed, trying prompt_versions:', result.error.message);
      result = await supabase
        .from('prompt_versions')
        .select('*')
        .order('agent_name')
        .order('created_at', { ascending: false });
    }

    if (result.error) {
      console.error('Error loading prompts:', result.error);
    } else {
      setPrompts(result.data || []);
    }

    try {
      const manifestRes = await fetch('/api/manifest');
      if (manifestRes.ok) {
        const manifestData = await manifestRes.json();
        setManifest(manifestData);
      }
    } catch (err) {
      console.warn('Failed to load manifest:', err);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadPrompts();
  }, [loadPrompts]);

  const promptsByAgent: PromptsByAgent = prompts.reduce((acc, prompt) => {
    if (!acc[prompt.agent_name]) {
      acc[prompt.agent_name] = [];
    }
    acc[prompt.agent_name].push(prompt);
    return acc;
  }, {} as PromptsByAgent);

  const agents = Object.keys(promptsByAgent);

  async function rollbackToVersion(prompt: PromptVersion): Promise<boolean> {
    if (!confirm(`Make "${prompt.version}" the current version for ${prompt.agent_name}?`)) {
      return false;
    }

    // Retire current PRD version
    await supabase
      .from('prompt_version')
      .update({ stage: 'RET', retired_at: new Date().toISOString() })
      .eq('agent_name', prompt.agent_name)
      .eq('stage', 'PRD');

    // Promote selected version to PRD
    const { error } = await supabase
      .from('prompt_version')
      .update({ stage: 'PRD', deployed_at: new Date().toISOString() })
      .eq('agent_name', prompt.agent_name)
      .eq('version', prompt.version);

    if (error) {
      alert('Failed to rollback: ' + error.message);
      return false;
    }

    loadPrompts();
    return true;
  }

  return {
    prompts,
    promptsByAgent,
    agents,
    manifest,
    loading,
    reload: loadPrompts,
    rollbackToVersion,
  };
}
