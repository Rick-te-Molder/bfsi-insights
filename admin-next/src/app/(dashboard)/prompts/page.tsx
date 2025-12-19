'use client';

import { useState, useMemo } from 'react';
import type { PromptVersion } from '@/types/database';
import { usePrompts } from './hooks';
import type { CoverageStats as CoverageStatsType } from './types';
import { AgentTable, CoverageStats, PromptEditModal, PromptPlayground } from './components';

export default function PromptsPage() {
  const { prompts, promptsByAgent, agents, manifest, loading, reload } = usePrompts();

  const [editingPrompt, setEditingPrompt] = useState<PromptVersion | null>(null);
  const [testingPrompt, setTestingPrompt] = useState<PromptVersion | null>(null);

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
            <h1 className="text-2xl font-bold text-white">Prompt Engineering</h1>
            <p className="mt-1 text-sm text-neutral-400">
              View, edit, and version LLM prompts for each agent
            </p>
          </div>
          <div className="text-sm text-neutral-400">
            {agents.length} agents • {prompts.length} total versions
          </div>
        </div>

        {coverageStats && <CoverageStats stats={coverageStats} />}
      </header>

      <div className="rounded-xl border border-neutral-800 overflow-hidden">
        <div className="overflow-auto">
          <AgentTable
            agents={agents}
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
