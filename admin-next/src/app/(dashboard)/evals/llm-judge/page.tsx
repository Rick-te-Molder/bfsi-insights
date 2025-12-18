'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface EvalRun {
  id: string;
  agent_name: string;
  prompt_version: string;
  eval_type: string;
  total_examples: number;
  passed: number | null;
  failed: number | null;
  score: number | null;
  status: string;
  created_at: string;
  finished_at: string | null;
}

interface PromptVersion {
  id: string;
  agent_name: string;
  version: string;
  is_current: boolean;
}

export default function LLMJudgePage() {
  const [runs, setRuns] = useState<EvalRun[]>([]);
  const [prompts, setPrompts] = useState<PromptVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [selectedPrompt, setSelectedPrompt] = useState<string>('');
  const [criteria, setCriteria] = useState('quality, accuracy, and completeness');

  const supabase = createClient();

  const loadData = useCallback(async () => {
    setLoading(true);

    const [runsRes, promptsRes] = await Promise.all([
      supabase
        .from('eval_run')
        .select('*')
        .eq('eval_type', 'llm_judge')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('prompt_version')
        .select('id, agent_name, version, is_current')
        .order('agent_name'),
    ]);

    if (!runsRes.error) setRuns(runsRes.data || []);
    if (!promptsRes.error) setPrompts(promptsRes.data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const agents = [...new Set(prompts.map((p) => p.agent_name))];
  const agentPrompts = prompts.filter((p) => p.agent_name === selectedAgent);

  async function handleRunEval() {
    if (!selectedPrompt) {
      alert('Please select a prompt version');
      return;
    }

    setRunning(true);
    try {
      const res = await fetch('/api/evals/llm-judge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptVersionId: selectedPrompt,
          criteria,
        }),
      });

      if (res.ok) {
        loadData();
      } else {
        const data = await res.json();
        alert('Failed to run eval: ' + data.error);
      }
    } catch {
      alert('Network error');
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-neutral-400">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">LLM-as-Judge</h1>
        <p className="text-neutral-400 mt-1">
          Use a second LLM to evaluate agent output quality against criteria
        </p>
      </header>

      {/* Run New Eval */}
      <div className="mb-8 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <h2 className="text-lg font-semibold text-white mb-4">Run New Evaluation</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-neutral-400 mb-1">Agent</label>
            <select
              value={selectedAgent}
              onChange={(e) => {
                setSelectedAgent(e.target.value);
                setSelectedPrompt('');
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
            <label className="block text-sm text-neutral-400 mb-1">Prompt Version</label>
            <select
              value={selectedPrompt}
              onChange={(e) => setSelectedPrompt(e.target.value)}
              disabled={!selectedAgent}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-white disabled:opacity-50"
            >
              <option value="">Select version...</option>
              {agentPrompts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.version} {p.is_current ? '(current)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-neutral-400 mb-1">Criteria</label>
            <input
              type="text"
              value={criteria}
              onChange={(e) => setCriteria(e.target.value)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-white"
              placeholder="quality, accuracy, completeness"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleRunEval}
              disabled={running || !selectedPrompt}
              className="w-full rounded-lg bg-sky-600 px-4 py-2 text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {running ? 'Running...' : 'Run Eval'}
            </button>
          </div>
        </div>
      </div>

      {/* Previous Runs */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900">
        <div className="border-b border-neutral-800 px-4 py-3">
          <h2 className="text-lg font-semibold text-white">Previous Runs</h2>
        </div>
        {runs.length === 0 ? (
          <div className="p-8 text-center text-neutral-500">
            No LLM-as-Judge evaluations yet. Run one above!
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-800 text-left text-sm text-neutral-400">
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3">Version</th>
                <th className="px-4 py-3">Examples</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30">
                  <td className="px-4 py-3 text-white">{run.agent_name}</td>
                  <td className="px-4 py-3 text-neutral-300">{run.prompt_version}</td>
                  <td className="px-4 py-3 text-neutral-300">{run.total_examples}</td>
                  <td className="px-4 py-3">
                    {run.score !== null ? (
                      <span
                        className={
                          run.score >= 0.8
                            ? 'text-emerald-400'
                            : run.score >= 0.5
                              ? 'text-yellow-400'
                              : 'text-red-400'
                        }
                      >
                        {(run.score * 100).toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-neutral-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        run.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : run.status === 'running'
                            ? 'bg-sky-500/20 text-sky-400'
                            : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {run.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-500 text-sm">
                    {new Date(run.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
