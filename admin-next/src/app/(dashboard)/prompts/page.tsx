'use client';

import { useState, useMemo } from 'react';
import type { PromptVersion } from '@/types/database';
import { usePrompts, useResizablePanel } from './hooks';
import type { CoverageStats as CoverageStatsType } from './types';
import {
  AgentDetail,
  AgentTable,
  CoverageStats,
  DiffModal,
  PromptEditModal,
  PromptPlayground,
  ViewVersionModal,
} from './components';

export default function PromptsPage() {
  const { prompts, promptsByAgent, agents, manifest, loading, reload, rollbackToVersion } =
    usePrompts();
  const { height: topPanelHeight, containerRef, handleMouseDown } = useResizablePanel();

  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [viewingVersion, setViewingVersion] = useState<PromptVersion | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<PromptVersion | null>(null);
  const [diffMode, setDiffMode] = useState<{ a: PromptVersion; b: PromptVersion } | null>(null);
  const [testingPrompt, setTestingPrompt] = useState<PromptVersion | null>(null);

  const coverageStats: CoverageStatsType | null = useMemo(() => {
    if (!manifest) return null;

    const currentPromptNames = new Set(
      prompts.filter((p) => p.is_current).map((p) => p.agent_name),
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

      <div
        ref={containerRef}
        className="flex flex-col"
        style={{ height: selectedAgent ? 'calc(100vh - 350px)' : 'auto' }}
      >
        <div
          className="rounded-xl border border-neutral-800 overflow-hidden"
          style={{ height: selectedAgent ? topPanelHeight : 'auto' }}
        >
          <div className="h-full overflow-auto">
            <AgentTable
              agents={agents}
              promptsByAgent={promptsByAgent}
              selectedAgent={selectedAgent}
              onSelectAgent={setSelectedAgent}
              onEdit={setEditingPrompt}
              onTest={setTestingPrompt}
            />
          </div>
        </div>

        {selectedAgent && (
          <div
            onMouseDown={handleMouseDown}
            className="h-2 cursor-row-resize flex items-center justify-center group hover:bg-neutral-800/50 transition-colors my-1"
          >
            <div className="w-16 h-1 rounded-full bg-neutral-700 group-hover:bg-neutral-500 transition-colors" />
          </div>
        )}

        {selectedAgent && promptsByAgent[selectedAgent] && (
          <div className="flex-1 min-h-0">
            <AgentDetail
              agentName={selectedAgent}
              prompts={promptsByAgent[selectedAgent]}
              onEdit={setEditingPrompt}
              onRollback={rollbackToVersion}
              onDiff={(a, b) => setDiffMode({ a, b })}
              onView={setViewingVersion}
              onTest={setTestingPrompt}
            />
          </div>
        )}
      </div>

      {editingPrompt && (
        <PromptEditModal
          prompt={editingPrompt}
          onClose={() => setEditingPrompt(null)}
          onSave={() => {
            setEditingPrompt(null);
            reload();
          }}
        />
      )}

      {diffMode && <DiffModal a={diffMode.a} b={diffMode.b} onClose={() => setDiffMode(null)} />}

      {viewingVersion && (
        <ViewVersionModal
          prompt={viewingVersion}
          onClose={() => setViewingVersion(null)}
          onRollback={() => {
            rollbackToVersion(viewingVersion);
            setViewingVersion(null);
          }}
        />
      )}

      {testingPrompt && (
        <PromptPlayground prompt={testingPrompt} onClose={() => setTestingPrompt(null)} />
      )}
    </div>
  );
}
