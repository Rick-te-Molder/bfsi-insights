import type { PromptVersion } from '@/types/database';
import type { AgentManifest, PromptsByAgent } from './types';
import type { AgentFilter } from './use-filtered-agents';
import { AgentsTableSection } from './agents-table-section';
import { AgentsHeader } from './agents-header';
import { AgentFilterTabs } from './agent-filter-tabs';
import { AgentsModals } from './agents-modals';
import { useAgentCoverageStats } from './use-agent-coverage-stats';
import { useFilteredAgents } from './use-filtered-agents';
import { useCallback } from 'react';

export interface PromptsData {
  readonly prompts: PromptVersion[];
  readonly promptsByAgent: PromptsByAgent;
  readonly agents: string[];
  readonly manifest: AgentManifest | null;
  readonly reload: () => Promise<void>;
}

export interface PageState {
  readonly editingPrompt: PromptVersion | null;
  readonly setEditingPrompt: (p: PromptVersion | null) => void;
  readonly testingPrompt: PromptVersion | null;
  readonly setTestingPrompt: (p: PromptVersion | null) => void;
  readonly agentFilter: AgentFilter;
  readonly setAgentFilter: (f: AgentFilter) => void;
  readonly closeEdit: () => void;
  readonly closeTest: () => void;
}

interface AgentsContentProps {
  readonly promptsData: PromptsData;
  readonly pageState: PageState;
}

function useReloadAfterSave(reload: () => Promise<void>, closeEdit: () => void) {
  return useCallback(async () => {
    closeEdit();
    await reload();
  }, [reload, closeEdit]);
}

function AgentsHeaderSection({
  prompts,
  agents,
  manifest,
}: Readonly<{
  prompts: PromptVersion[];
  agents: string[];
  manifest: AgentManifest | null;
}>) {
  const coverageStats = useAgentCoverageStats({ manifest, prompts });
  return (
    <AgentsHeader
      agentCount={agents.length}
      promptCount={prompts.length}
      coverageStats={coverageStats}
    />
  );
}

function AgentsFilterSection({
  agents,
  promptsByAgent,
  agentFilter,
  setAgentFilter,
}: Readonly<{
  agents: string[];
  promptsByAgent: PromptsByAgent;
  agentFilter: AgentFilter;
  setAgentFilter: (f: AgentFilter) => void;
}>) {
  return (
    <AgentFilterTabs
      agents={agents}
      promptsByAgent={promptsByAgent}
      value={agentFilter}
      onChange={setAgentFilter}
    />
  );
}

function AgentsTableContent({
  agents,
  promptsByAgent,
  filter,
  onEdit,
  onTest,
}: Readonly<{
  agents: string[];
  promptsByAgent: PromptsByAgent;
  filter: AgentFilter;
  onEdit: (p: PromptVersion | null) => void;
  onTest: (p: PromptVersion | null) => void;
}>) {
  const filteredAgents = useFilteredAgents({ agents, promptsByAgent, filter });
  return (
    <AgentsTableSection
      agents={filteredAgents}
      promptsByAgent={promptsByAgent}
      onEdit={onEdit}
      onTest={onTest}
    />
  );
}

function AgentsModalsSection({
  pageState,
  handleSaveEdit,
}: Readonly<{
  pageState: PageState;
  handleSaveEdit: () => Promise<void>;
}>) {
  return (
    <AgentsModals
      editingPrompt={pageState.editingPrompt}
      testingPrompt={pageState.testingPrompt}
      onCloseEdit={pageState.closeEdit}
      onSaveEdit={handleSaveEdit}
      onCloseTest={pageState.closeTest}
    />
  );
}

export function AgentsContent({ promptsData, pageState }: AgentsContentProps) {
  const { prompts, promptsByAgent, agents, manifest, reload } = promptsData;
  const handleSaveEdit = useReloadAfterSave(reload, pageState.closeEdit);

  return (
    <div>
      <AgentsHeaderSection prompts={prompts} agents={agents} manifest={manifest} />
      <AgentsFilterSection
        agents={agents}
        promptsByAgent={promptsByAgent}
        agentFilter={pageState.agentFilter}
        setAgentFilter={pageState.setAgentFilter}
      />
      <AgentsTableContent
        agents={agents}
        promptsByAgent={promptsByAgent}
        filter={pageState.agentFilter}
        onEdit={pageState.setEditingPrompt}
        onTest={pageState.setTestingPrompt}
      />
      <AgentsModalsSection pageState={pageState} handleSaveEdit={handleSaveEdit} />
    </div>
  );
}
