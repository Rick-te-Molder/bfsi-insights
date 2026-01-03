'use client';

interface PromptVersion {
  id: string;
  agent_name: string;
  version: string;
  is_current: boolean;
  stage?: string;
}

interface AgentVersionSelectProps {
  agents: string[];
  prompts: PromptVersion[];
  selectedAgent: string;
  selectedVersion: string;
  onAgentChange: (agent: string) => void;
  onVersionChange: (versionId: string) => void;
  versionLabel?: string;
  showStage?: boolean;
}

export function AgentVersionSelect({
  agents,
  prompts,
  selectedAgent,
  selectedVersion,
  onAgentChange,
  onVersionChange,
  versionLabel = 'Prompt Version',
  showStage = false,
}: AgentVersionSelectProps) {
  const agentPrompts = prompts.filter((p) => p.agent_name === selectedAgent);

  return (
    <>
      <div>
        <label className="block text-sm text-neutral-400 mb-1">Agent</label>
        <select
          value={selectedAgent}
          onChange={(e) => {
            onAgentChange(e.target.value);
            onVersionChange('');
          }}
          className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-white"
        >
          <option value="">Select agent...</option>
          {agents.map((agent) => (
            <option key={agent} value={agent}>
              {agent}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm text-neutral-400 mb-1">{versionLabel}</label>
        <select
          value={selectedVersion}
          onChange={(e) => onVersionChange(e.target.value)}
          disabled={!selectedAgent}
          className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-white disabled:opacity-50"
        >
          <option value="">Select version...</option>
          {agentPrompts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.version}
              {showStage && p.stage ? ` (${p.stage})` : ''}
              {p.is_current ? ' ★' : ''}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
