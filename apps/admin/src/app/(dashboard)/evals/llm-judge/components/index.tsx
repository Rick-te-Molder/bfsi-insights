'use client';

interface PromptVersion {
  id: string;
  agent_name: string;
  version: string;
  stage: string;
}

export function PageHeader() {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-bold text-white">LLM-as-Judge</h1>
      <p className="text-neutral-400 mt-1">
        Use a second LLM to evaluate agent output quality against criteria
      </p>
    </header>
  );
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
      <label htmlFor="judgeAgent" className="block text-sm text-neutral-400 mb-1">
        Agent
      </label>
      <select
        id="judgeAgent"
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

interface PromptSelectProps {
  prompts: PromptVersion[];
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}

function PromptOptions({ prompts }: Readonly<{ prompts: PromptVersion[] }>) {
  return (
    <>
      <option value="">Select version...</option>
      {prompts.map((p) => (
        <option key={p.id} value={p.id}>
          {p.version} {p.stage === 'PRD' ? '(live)' : ''}
        </option>
      ))}
    </>
  );
}

export function PromptSelect({ prompts, value, onChange, disabled }: Readonly<PromptSelectProps>) {
  return (
    <div>
      <label htmlFor="judgePrompt" className="block text-sm text-neutral-400 mb-1">
        Prompt Version
      </label>
      <select
        id="judgePrompt"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-white disabled:opacity-50"
      >
        <PromptOptions prompts={prompts} />
      </select>
    </div>
  );
}

export function CriteriaInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label htmlFor="judgeCriteria" className="block text-sm text-neutral-400 mb-1">
        Criteria
      </label>
      <input
        id="judgeCriteria"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-white"
        placeholder="quality, accuracy, completeness"
      />
    </div>
  );
}

export function RunButton({
  onClick,
  disabled,
  running,
}: {
  onClick: () => void;
  disabled: boolean;
  running: boolean;
}) {
  return (
    <div className="flex items-end">
      <button
        onClick={onClick}
        disabled={disabled}
        className="w-full rounded-lg bg-sky-600 px-4 py-2 text-white hover:bg-sky-500 disabled:opacity-50"
      >
        {running ? 'Running...' : 'Run Eval'}
      </button>
    </div>
  );
}

export { type PromptVersion };
