'use client';

import { useState } from 'react';
import type { PromptVersion } from '@/types/database';
import { ModalWrapper } from './ModalWrapper';
import { estimateTokens } from '../utils';

interface PromptPlaygroundProps {
  prompt: PromptVersion;
  onClose: () => void;
}

function PlaygroundHeader({ prompt }: Readonly<{ prompt: PromptVersion }>) {
  return (
    <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span>🧪</span> Test Playground
        </h2>
        <p className="text-sm text-neutral-400">
          {prompt.agent_name} • {prompt.version}
        </p>
      </div>
      <span className="text-xs text-neutral-500">
        ~{estimateTokens(prompt.prompt_text).toLocaleString()} tokens
      </span>
    </div>
  );
}

function PromptPreview({ text }: Readonly<{ text: string }>) {
  return (
    <div>
      <span className="block text-sm text-neutral-400 mb-1">
        Prompt ({text.length.toLocaleString()} chars)
      </span>
      <pre className="p-3 rounded-md bg-neutral-950 text-xs text-neutral-400 max-h-32 overflow-y-auto whitespace-pre-wrap">
        {text.slice(0, 500)}
        {text.length > 500 && '...'}
      </pre>
    </div>
  );
}

function TestInputField({
  value,
  onChange,
}: Readonly<{ value: string; onChange: (v: string) => void }>) {
  return (
    <div>
      <label htmlFor="testInput" className="block text-sm text-neutral-400 mb-1">
        Test Input (sample content to classify/process)
      </label>
      <textarea
        id="testInput"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste article text, title, or any content you want to test the prompt against..."
        className="w-full h-40 rounded-md border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-neutral-300 resize-none"
      />
    </div>
  );
}

function RunButton({
  onClick,
  disabled,
  testing,
}: Readonly<{
  onClick: () => void;
  disabled: boolean;
  testing: boolean;
}>) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-50"
    >
      {testing ? 'Running...' : '▶ Run Test'}
    </button>
  );
}

function OutputDisplay({ output }: Readonly<{ output: string }>) {
  return (
    <div>
      <span className="block text-sm text-neutral-400 mb-1">Output</span>
      <pre className="p-4 rounded-md bg-emerald-950/50 border border-emerald-500/20 text-sm text-emerald-300 overflow-auto max-h-64 whitespace-pre-wrap">
        {output}
      </pre>
    </div>
  );
}

function PlaygroundFooter({ onClose }: Readonly<{ onClose: () => void }>) {
  return (
    <div className="p-4 border-t border-neutral-800 flex justify-between items-center">
      <p className="text-xs text-neutral-500">
        Note: This runs the prompt against the test input using the configured model
      </p>
      <button
        onClick={onClose}
        className="rounded-md px-4 py-2 text-sm text-neutral-400 hover:text-white"
      >
        Close
      </button>
    </div>
  );
}

async function executeTest(
  prompt: PromptVersion,
  testInput: string,
): Promise<{ output?: string; error?: string }> {
  try {
    const response = await fetch('/api/test-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentName: prompt.agent_name,
        promptText: prompt.prompt_text,
        testInput,
      }),
    });
    const data = await response.json();
    return response.ok
      ? { output: JSON.stringify(data.result, null, 2) }
      : { error: data.error || 'Test failed' };
  } catch (err) {
    return {
      error: 'Failed to run test: ' + (err instanceof Error ? err.message : 'Unknown error'),
    };
  }
}

function usePlaygroundState() {
  const [testInput, setTestInput] = useState('');
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return {
    testInput,
    setTestInput,
    testOutput,
    setTestOutput,
    testing,
    setTesting,
    error,
    setError,
  };
}

function PlaygroundBody({
  prompt,
  state,
  onRun,
}: Readonly<{
  prompt: PromptVersion;
  state: ReturnType<typeof usePlaygroundState>;
  onRun: () => void;
}>) {
  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      <PromptPreview text={prompt.prompt_text} />
      <TestInputField value={state.testInput} onChange={state.setTestInput} />
      <div className="flex items-center gap-3">
        <RunButton
          onClick={onRun}
          disabled={state.testing || !state.testInput.trim()}
          testing={state.testing}
        />
        {state.error && <span className="text-sm text-red-400">{state.error}</span>}
      </div>
      {state.testOutput && <OutputDisplay output={state.testOutput} />}
    </div>
  );
}

export function PromptPlayground({ prompt, onClose }: Readonly<PromptPlaygroundProps>) {
  const state = usePlaygroundState();

  async function runTest() {
    if (!state.testInput.trim()) {
      state.setError('Please enter some test content');
      return;
    }
    state.setTesting(true);
    state.setError(null);
    state.setTestOutput(null);
    const result = await executeTest(prompt, state.testInput);
    if (result.error) state.setError(result.error);
    else state.setTestOutput(result.output || null);
    state.setTesting(false);
  }

  return (
    <ModalWrapper onClose={onClose}>
      <PlaygroundHeader prompt={prompt} />
      <PlaygroundBody prompt={prompt} state={state} onRun={runTest} />
      <PlaygroundFooter onClose={onClose} />
    </ModalWrapper>
  );
}
