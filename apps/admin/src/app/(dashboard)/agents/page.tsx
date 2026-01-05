'use client';

import { useCallback, useState } from 'react';
import type { PromptVersion } from '@/types/database';
import { usePrompts } from './hooks';
import { AgentTable } from './components';
import { AgentsHeader } from './agents-header';
import { AgentFilterTabs } from './agent-filter-tabs';
import { AgentsModals } from './agents-modals';
import { AgentsLoading } from './agents-loading';
import { useAgentCoverageStats } from './use-agent-coverage-stats';
import { useFilteredAgents, type AgentFilter } from './use-filtered-agents';

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

function useReloadAfterSave(opts: { reload: () => Promise<void>; closeEdit: () => void }) {
  return useCallback(async () => {
    opts.closeEdit();
    await opts.reload();
  }, [opts]);
}

export default function AgentsPage() {
  const { prompts, promptsByAgent, agents, manifest, loading, reload } = usePrompts();

  const pageState = useAgentsPageState();
  const coverageStats = useAgentCoverageStats({ manifest, prompts });
  const filteredAgents = useFilteredAgents({
    agents,
    promptsByAgent,
    filter: pageState.agentFilter,
  });
  const handleSaveEdit = useReloadAfterSave({ reload, closeEdit: pageState.closeEdit });

  if (loading) {
    return <AgentsLoading />;
  }

  return (
    <div>
      <AgentsHeader
        agentCount={agents.length}
        promptCount={prompts.length}
        coverageStats={coverageStats}
      />

      <AgentFilterTabs
        agents={agents}
        promptsByAgent={promptsByAgent}
        value={pageState.agentFilter}
        onChange={pageState.setAgentFilter}
      />

      <div className="rounded-xl border border-neutral-800 overflow-hidden">
        <div className="overflow-auto">
          <AgentTable
            agents={filteredAgents}
            promptsByAgent={promptsByAgent}
            onEdit={pageState.setEditingPrompt}
            onTest={pageState.setTestingPrompt}
          />
        </div>
      </div>

      <AgentsModals
        editingPrompt={pageState.editingPrompt}
        testingPrompt={pageState.testingPrompt}
        onCloseEdit={pageState.closeEdit}
        onSaveEdit={handleSaveEdit}
        onCloseTest={pageState.closeTest}
      />
    </div>
  );
}
