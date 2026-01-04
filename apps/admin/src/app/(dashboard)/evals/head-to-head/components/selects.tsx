'use client';

interface PromptItem {
  id: string;
  version: string;
  stage: string;
}

export function AgentSelect({
  agents,
  value,
  onChange,
}: {
  agents: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label htmlFor="h2hAgent" className="block text-sm text-neutral-400 mb-1">
        Agent
      </label>
      <select
        id="h2hAgent"
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

export function VersionSelect({
  id,
  label,
  value,
  onChange,
  disabled,
  prompts,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  prompts: PromptItem[];
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm text-neutral-400 mb-1">
        {label}
      </label>
      <VersionOptions
        id={id}
        value={value}
        onChange={onChange}
        disabled={disabled}
        prompts={prompts}
      />
    </div>
  );
}

function VersionOptions({
  id,
  value,
  onChange,
  disabled,
  prompts,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  prompts: PromptItem[];
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-white disabled:opacity-50"
    >
      <option value="">Select version...</option>
      {prompts.map((p) => (
        <option key={p.id} value={p.id}>
          {p.version} ({p.stage}) {p.stage === 'PRD' ? '★' : ''}
        </option>
      ))}
    </select>
  );
}
