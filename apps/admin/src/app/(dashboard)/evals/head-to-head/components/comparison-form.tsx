'use client';

import { AgentSelect, VersionSelect } from './selects';
import { ItemSelector } from './item-selector';
import { ComparisonControls } from './controls';

interface PromptItem {
  id: string;
  version: string;
  stage: string;
  agent_name: string;
}

interface StatusItem {
  code: number;
  name: string;
}

interface ComparisonFormProps {
  agents: string[];
  selectedAgent: string;
  onAgentChange: (v: string) => void;
  agentPrompts: PromptItem[];
  versionA: string;
  setVersionA: (v: string) => void;
  versionB: string;
  setVersionB: (v: string) => void;
  statuses: StatusItem[];
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  selectedItem: string;
  setSelectedItem: (v: string) => void;
  filteredItems: { id: string }[];
  useLLMJudge: boolean;
  setUseLLMJudge: (v: boolean) => void;
  onRun: () => void;
  running: boolean;
}

function FormHeader() {
  return <h2 className="text-lg font-semibold text-white mb-4">New Comparison</h2>;
}

function VersionSelectA({
  agentPrompts,
  versionA,
  setVersionA,
  disabled,
}: {
  agentPrompts: PromptItem[];
  versionA: string;
  setVersionA: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <VersionSelect
      id="h2hVersionA"
      label="Version A (Control)"
      value={versionA}
      onChange={setVersionA}
      disabled={disabled}
      prompts={agentPrompts}
    />
  );
}

function VersionSelectB({
  agentPrompts,
  versionB,
  setVersionB,
  disabled,
}: {
  agentPrompts: PromptItem[];
  versionB: string;
  setVersionB: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <VersionSelect
      id="h2hVersionB"
      label="Version B (Treatment)"
      value={versionB}
      onChange={setVersionB}
      disabled={disabled}
      prompts={agentPrompts}
    />
  );
}

function VersionSelects(props: ComparisonFormProps) {
  const disabled = !props.selectedAgent;
  return (
    <>
      <VersionSelectA
        agentPrompts={props.agentPrompts}
        versionA={props.versionA}
        setVersionA={props.setVersionA}
        disabled={disabled}
      />
      <VersionSelectB
        agentPrompts={props.agentPrompts}
        versionB={props.versionB}
        setVersionB={props.setVersionB}
        disabled={disabled}
      />
    </>
  );
}

function FormGrid(props: ComparisonFormProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      <AgentSelect
        agents={props.agents}
        value={props.selectedAgent}
        onChange={props.onAgentChange}
      />
      <VersionSelects {...props} />
      <ItemSelector
        statuses={props.statuses}
        statusFilter={props.statusFilter}
        setStatusFilter={props.setStatusFilter}
        searchQuery={props.searchQuery}
        setSearchQuery={props.setSearchQuery}
        selectedItem={props.selectedItem}
        setSelectedItem={props.setSelectedItem}
        filteredItems={props.filteredItems}
      />
    </div>
  );
}

export function ComparisonForm(props: ComparisonFormProps) {
  const runDisabled = props.running || !props.versionA || !props.versionB || !props.selectedItem;
  return (
    <div className="mb-8 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <FormHeader />
      <FormGrid {...props} />
      <ComparisonControls
        useLLMJudge={props.useLLMJudge}
        setUseLLMJudge={props.setUseLLMJudge}
        onRun={props.onRun}
        running={props.running}
        disabled={runDisabled}
      />
    </div>
  );
}
