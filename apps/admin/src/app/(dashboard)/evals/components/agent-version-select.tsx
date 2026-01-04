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

function AgentDropdown({
  agents,
  value,
  onChange,
}: Readonly<{
  agents: string[];
  value: string;
  onChange: (v: string) => void;
}>) {
  return (
    <div>
      <label htmlFor="agentSelect" className="block text-sm text-neutral-400 mb-1">
        Agent
      </label>
      <select
        id="agentSelect"
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
  );
}

function VersionOption({ p, showStage }: Readonly<{ p: PromptVersion; showStage: boolean }>) {
  const stageText = showStage && p.stage ? ` (${p.stage})` : '';
  const currentMark = p.is_current ? ' ★' : '';
  return (
    <option value={p.id}>
      {p.version}
      {stageText}
      {currentMark}
    </option>
  );
}

interface VersionDropdownProps {
  prompts: PromptVersion[];
  value: string;
  onChange: (v: string) => void;
  label: string;
  disabled: boolean;
  showStage: boolean;
}

function VersionDropdown({
  prompts,
  value,
  onChange,
  label,
  disabled,
  showStage,
}: Readonly<VersionDropdownProps>) {
  return (
    <div>
      <label htmlFor="versionSelect" className="block text-sm text-neutral-400 mb-1">
        {label}
      </label>
      <select
        id="versionSelect"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-white disabled:opacity-50"
      >
        <option value="">Select version...</option>
        {prompts.map((p) => (
          <VersionOption key={p.id} p={p} showStage={showStage} />
        ))}
      </select>
    </div>
  );
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
}: Readonly<AgentVersionSelectProps>) {
  const agentPrompts = prompts.filter((p) => p.agent_name === selectedAgent);
  const handleAgentChange = (v: string) => {
    onAgentChange(v);
    onVersionChange('');
  };
  return (
    <>
      <AgentDropdown agents={agents} value={selectedAgent} onChange={handleAgentChange} />
      <VersionDropdown
        prompts={agentPrompts}
        value={selectedVersion}
        onChange={onVersionChange}
        label={versionLabel}
        disabled={!selectedAgent}
        showStage={showStage}
      />
    </>
  );
}
