'use client';

import { useState } from 'react';
import {
  PageHeader,
  AgentSelect,
  PromptSelect,
  CriteriaInput,
  RunButton,
} from './components/index';
import { RunsTable } from './components/runs-table';
import { useLLMJudgeData } from './hooks/useLLMJudgeData';

interface EvalFormProps {
  agents: string[];
  agentPrompts: { id: string; version: string; stage: string; agent_name: string }[];
  selectedAgent: string;
  onAgentChange: (v: string) => void;
  selectedPrompt: string;
  onPromptChange: (v: string) => void;
  criteria: string;
  onCriteriaChange: (v: string) => void;
  onRun: () => void;
  running: boolean;
}

function EvalFormGrid(props: Readonly<EvalFormProps>) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <AgentSelect
        agents={props.agents}
        value={props.selectedAgent}
        onChange={props.onAgentChange}
      />
      <PromptSelect
        prompts={props.agentPrompts}
        value={props.selectedPrompt}
        onChange={props.onPromptChange}
        disabled={!props.selectedAgent}
      />
      <CriteriaInput value={props.criteria} onChange={props.onCriteriaChange} />
      <RunButton
        onClick={props.onRun}
        disabled={props.running || !props.selectedPrompt}
        running={props.running}
      />
    </div>
  );
}

function EvalForm(props: Readonly<EvalFormProps>) {
  return (
    <div className="mb-8 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <h2 className="text-lg font-semibold text-white mb-4">Run New Evaluation</h2>
      <EvalFormGrid {...props} />
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RunsSection({ runs }: Readonly<{ runs: any[] }>) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900">
      <div className="border-b border-neutral-800 px-4 py-3">
        <h2 className="text-lg font-semibold text-white">Previous Runs</h2>
      </div>
      <RunsTable runs={runs} />
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-neutral-400">Loading...</div>
    </div>
  );
}

function useLLMJudgeState(prompts: { agent_name: string }[]) {
  const [running, setRunning] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [selectedPrompt, setSelectedPrompt] = useState('');
  const [criteria, setCriteria] = useState('quality, accuracy, and completeness');
  const agents = [...new Set(prompts.map((p) => p.agent_name))];

  const handleAgentChange = (v: string) => {
    setSelectedAgent(v);
    setSelectedPrompt('');
  };

  return {
    running,
    setRunning,
    selectedAgent,
    selectedPrompt,
    setSelectedPrompt,
    criteria,
    setCriteria,
    agents,
    handleAgentChange,
  };
}

async function postEvalRun(payload: { promptVersionId: string; criteria: string }) {
  return fetch('/api/evals/llm-judge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

async function showEvalRunError(res: Response) {
  const data = await res.json();
  alert('Failed to run eval: ' + data.error);
}

async function runEvaluation(
  selectedPrompt: string,
  criteria: string,
  setRunning: (v: boolean) => void,
  loadData: () => void,
) {
  if (!selectedPrompt) {
    alert('Please select a prompt version');
    return;
  }
  setRunning(true);
  try {
    const res = await postEvalRun({ promptVersionId: selectedPrompt, criteria });
    if (res.ok) loadData();
    else await showEvalRunError(res);
  } catch {
    alert('Network error');
  } finally {
    setRunning(false);
  }
}

export function LLMJudgePageClient() {
  const { runs, prompts, loading, loadData } = useLLMJudgeData();
  const state = useLLMJudgeState(prompts);
  const agentPrompts = prompts.filter((p) => p.agent_name === state.selectedAgent);
  const handleRunEval = () =>
    runEvaluation(state.selectedPrompt, state.criteria, state.setRunning, loadData);

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader />
      <EvalForm
        agents={state.agents}
        agentPrompts={agentPrompts}
        selectedAgent={state.selectedAgent}
        onAgentChange={state.handleAgentChange}
        selectedPrompt={state.selectedPrompt}
        onPromptChange={state.setSelectedPrompt}
        criteria={state.criteria}
        onCriteriaChange={state.setCriteria}
        onRun={handleRunEval}
        running={state.running}
      />
      <RunsSection runs={runs} />
    </div>
  );
}
