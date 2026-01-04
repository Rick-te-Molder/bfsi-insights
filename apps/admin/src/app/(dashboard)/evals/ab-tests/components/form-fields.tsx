'use client';

import type { PromptVersion } from '@/types/database';

const inputClass =
  'w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-white';
const labelClass = 'block text-sm text-neutral-400 mb-1';

export function TestNameField({
  value,
  onChange,
}: Readonly<{
  value: string;
  onChange: (v: string) => void;
}>) {
  return (
    <div>
      <label htmlFor="testName" className={labelClass}>
        Test Name (optional)
      </label>
      <input
        id="testName"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g., Tagger mutual exclusivity test"
        className={inputClass}
      />
    </div>
  );
}

export function AgentSelect({
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
      <label htmlFor="agentSelect" className={labelClass}>
        Agent
      </label>
      <select
        id="agentSelect"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      >
        {agents.map((agent) => (
          <option key={agent} value={agent}>
            {agent}
          </option>
        ))}
      </select>
    </div>
  );
}

function VariantOptions({ prompts }: Readonly<{ prompts: PromptVersion[] }>) {
  return (
    <>
      <option value="">Select version</option>
      {prompts.map((p) => (
        <option key={p.version} value={p.version}>
          {p.version} {p.stage === 'PRD' ? '(live)' : ''}
        </option>
      ))}
    </>
  );
}

interface VariantSelectProps {
  id: string;
  label: string;
  color: string;
  value: string;
  onChange: (v: string) => void;
  prompts: PromptVersion[];
}

export function VariantSelect({
  id,
  label,
  color,
  value,
  onChange,
  prompts,
}: Readonly<VariantSelectProps>) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label} <span className={color}></span>
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      >
        <VariantOptions prompts={prompts} />
      </select>
    </div>
  );
}

export function TrafficSplitField({
  value,
  onChange,
}: Readonly<{
  value: number;
  onChange: (v: number) => void;
}>) {
  return (
    <div>
      <label htmlFor="trafficSplit" className={labelClass}>
        Traffic Split (Variant B %)
      </label>
      <input
        id="trafficSplit"
        type="range"
        min="10"
        max="90"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
      <div className="flex justify-between text-xs text-neutral-500 mt-1">
        <span>A: {100 - value}%</span>
        <span>B: {value}%</span>
      </div>
    </div>
  );
}

export function SampleSizeField({
  value,
  onChange,
}: Readonly<{
  value: number;
  onChange: (v: number) => void;
}>) {
  return (
    <div>
      <label htmlFor="sampleSize" className={labelClass}>
        Sample Size
      </label>
      <input
        id="sampleSize"
        type="number"
        min="10"
        max="10000"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={inputClass}
      />
    </div>
  );
}

export function ModalFooter({
  onClose,
  onCreate,
  saving,
}: Readonly<{
  onClose: () => void;
  onCreate: () => void;
  saving: boolean;
}>) {
  return (
    <div className="flex justify-end gap-2 mt-6">
      <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-400 hover:text-white">
        Cancel
      </button>
      <button
        onClick={onCreate}
        disabled={saving}
        className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
      >
        {saving ? 'Creating...' : 'Create Test'}
      </button>
    </div>
  );
}
