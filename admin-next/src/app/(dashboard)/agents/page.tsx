'use client';

import { useState, useMemo } from 'react';
import type { PromptVersion } from '@/types/database';
import { usePrompts } from './hooks';
import type { CoverageStats as CoverageStatsType, AgentType } from './types';
import { AgentTable, CoverageStats, PromptEditModal, PromptPlayground } from './components';

type AgentFilter = 'all' | AgentType;

export default function AgentsPage() {
  const { prompts, promptsByAgent, agents, manifest, loading, reload } = usePrompts();

  const [editingPrompt, setEditingPrompt] = useState<PromptVersion | null>(null);
  const [testingPrompt, setTestingPrompt] = useState<PromptVersion | null>(null);
  const [agentFilter, setAgentFilter] = useState<AgentFilter>('all');

  const coverageStats: CoverageStatsType | null = useMemo(() => {
    if (!manifest) return null;

    const currentPromptNames = new Set(
      prompts.filter((p) => p.stage === 'PRD').map((p) => p.agent_name),
    );

    const requiredPrompts = manifest.required_prompts.filter((p) => p.required);
    const presentRequired = requiredPrompts.filter((p) => currentPromptNames.has(p.agent_name));
    const missingRequired = requiredPrompts.filter((p) => !currentPromptNames.has(p.agent_name));

    return {
      totalAgents: manifest.agents.length,
      totalPrompts: prompts.length,
      currentPrompts: currentPromptNames.size,
      requiredPrompts: requiredPrompts.length,
      presentRequired: presentRequired.length,
      missingRequired: missingRequired.map((p) => p.agent_name),
      coverage:
        requiredPrompts.length > 0
          ? Math.round((presentRequired.length / requiredPrompts.length) * 100)
          : 100,
    };
  }, [manifest, prompts]);

  // Filter agents by type
  const filteredAgents = useMemo(() => {
    if (agentFilter === 'all') return agents;

    const utilityAgents = ['thumbnail-generator'];
    const orchestratorAgents = ['enricher', 'improver'];

    return agents.filter((agentName) => {
      const hasPrompts = promptsByAgent[agentName]?.length > 0;

      if (agentFilter === 'llm') {
        return hasPrompts;
      } else if (agentFilter === 'utility') {
        return utilityAgents.includes(agentName);
      } else if (agentFilter === 'orchestrator') {
        return orchestratorAgents.includes(agentName);
      }
      return true;
    });
  }, [agents, agentFilter, promptsByAgent]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-neutral-400">Loading prompts...</div>
      </div>
    );
  }

  return (
    <div>
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Agent Management</h1>
            <p className="mt-1 text-sm text-neutral-400">
              Manage all agents: LLM, Utility, and Orchestrator agents
            </p>
          </div>
          <div className="text-sm text-neutral-400">
            {agents.length} agents • {prompts.length} prompt versions
          </div>
        </div>

        {coverageStats && <CoverageStats stats={coverageStats} />}
      </header>

      {/* Agent Type Filter Tabs */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setAgentFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            agentFilter === 'all'
              ? 'bg-sky-500 text-white'
              : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
          }`}
        >
          All ({agents.length})
        </button>
        <button
          onClick={() => setAgentFilter('llm')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            agentFilter === 'llm'
              ? 'bg-sky-500 text-white'
              : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
          }`}
        >
          LLM ({agents.filter((a) => promptsByAgent[a]?.length > 0).length})
        </button>
        <button
          onClick={() => setAgentFilter('utility')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            agentFilter === 'utility'
              ? 'bg-sky-500 text-white'
              : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
          }`}
        >
          Utility (1)
        </button>
        <button
          onClick={() => setAgentFilter('orchestrator')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            agentFilter === 'orchestrator'
              ? 'bg-sky-500 text-white'
              : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
          }`}
        >
          Orchestrator (2)
        </button>
      </div>

      <div className="rounded-xl border border-neutral-800 overflow-hidden">
        <div className="overflow-auto">
          <AgentTable
            agents={filteredAgents}
            promptsByAgent={promptsByAgent}
            onEdit={setEditingPrompt}
            onTest={setTestingPrompt}
          />
        </div>
      </div>

      {editingPrompt && (
        <PromptEditModal
          prompt={editingPrompt}
          mode="create"
          onClose={() => setEditingPrompt(null)}
          onSave={() => {
            setEditingPrompt(null);
            reload();
          }}
        />
      )}

      {testingPrompt && (
        <PromptPlayground prompt={testingPrompt} onClose={() => setTestingPrompt(null)} />
      )}
    </div>
  );
}
