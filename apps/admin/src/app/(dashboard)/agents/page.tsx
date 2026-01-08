'use client';

import { useCallback, useState } from 'react';
import type { PromptVersion } from '@/types/database';
import { usePrompts } from './hooks';
import { AgentsLoading } from './agents-loading';
import { AgentsContent } from './agents-content';
import type { AgentFilter } from './use-filtered-agents';

function useAgentsPageState() {
  const [editingPrompt, setEditingPrompt] = useState<PromptVersion | null>(null);
  const [testingPrompt, setTestingPrompt] = useState<PromptVersion | null>(null);
  const [agentFilter, setAgentFilter] = useState<AgentFilter>('all');
  const closeEdit = useCallback(() => setEditingPrompt(null), []);
  const closeTest = useCallback(() => setTestingPrompt(null), []);

  return {
    editingPrompt,
    setEditingPrompt,
    testingPrompt,
    setTestingPrompt,
    agentFilter,
    setAgentFilter,
    closeEdit,
    closeTest,
  };
}

export default function AgentsPage() {
  const promptsData = usePrompts();
  const pageState = useAgentsPageState();

  if (promptsData.loading) return <AgentsLoading />;

  return <AgentsContent promptsData={promptsData} pageState={pageState} />;
}
