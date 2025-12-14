'use client';

import { useState } from 'react';
import type { PromptVersion } from '@/types/database';
import { ModalWrapper } from './ModalWrapper';
import { estimateTokens } from '../utils';

interface PromptPlaygroundProps {
  prompt: PromptVersion;
  onClose: () => void;
}

export function PromptPlayground({ prompt, onClose }: PromptPlaygroundProps) {
  const [testInput, setTestInput] = useState('');
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runTest() {
    if (!testInput.trim()) {
      setError('Please enter some test content');
      return;
    }

    setTesting(true);
    setError(null);
    setTestOutput(null);

    try {
      const response = await fetch('/api/test-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentName: prompt.agent_name,
          promptText: prompt.prompt_text,
          testInput: testInput,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Test failed');
      } else {
        setTestOutput(JSON.stringify(data.result, null, 2));
      }
    } catch (err) {
      setError('Failed to run test: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setTesting(false);
    }
  }

  return (
    <ModalWrapper onClose={onClose}>
      <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>🧪</span> Test Playground
          </h2>
          <p className="text-sm text-neutral-400">
            {prompt.agent_name} • {prompt.version}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500">
            ~{estimateTokens(prompt.prompt_text).toLocaleString()} tokens
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div>
          <label className="block text-sm text-neutral-400 mb-1">
            Prompt ({prompt.prompt_text.length.toLocaleString()} chars)
          </label>
          <pre className="p-3 rounded-md bg-neutral-950 text-xs text-neutral-400 max-h-32 overflow-y-auto whitespace-pre-wrap">
            {prompt.prompt_text.slice(0, 500)}
            {prompt.prompt_text.length > 500 && '...'}
          </pre>
        </div>

        <div>
          <label className="block text-sm text-neutral-400 mb-1">
            Test Input (sample content to classify/process)
          </label>
          <textarea
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            placeholder="Paste article text, title, or any content you want to test the prompt against..."
            className="w-full h-40 rounded-md border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-neutral-300 resize-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={runTest}
            disabled={testing || !testInput.trim()}
            className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-50"
          >
            {testing ? 'Running...' : '▶ Run Test'}
          </button>
          {error && <span className="text-sm text-red-400">{error}</span>}
        </div>

        {testOutput && (
          <div>
            <label className="block text-sm text-neutral-400 mb-1">Output</label>
            <pre className="p-4 rounded-md bg-emerald-950/50 border border-emerald-500/20 text-sm text-emerald-300 overflow-auto max-h-64 whitespace-pre-wrap">
              {testOutput}
            </pre>
          </div>
        )}
      </div>

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
    </ModalWrapper>
  );
}
