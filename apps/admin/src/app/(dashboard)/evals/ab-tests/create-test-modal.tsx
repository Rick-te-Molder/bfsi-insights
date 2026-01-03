'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { PromptVersion } from '@/types/database';

interface CreateTestModalProps {
  agents: string[];
  prompts: PromptVersion[];
  onClose: () => void;
  onCreated: () => void;
}

export function CreateTestModal({ agents, prompts, onClose, onCreated }: CreateTestModalProps) {
  const [agentName, setAgentName] = useState(agents[0] || '');
  const [variantA, setVariantA] = useState('');
  const [variantB, setVariantB] = useState('');
  const [trafficSplit, setTrafficSplit] = useState(50);
  const [sampleSize, setSampleSize] = useState(100);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  const agentPrompts = prompts.filter((p) => p.agent_name === agentName);
  const currentPrompt = agentPrompts.find((p) => p.stage === 'PRD');

  useEffect(() => {
    if (currentPrompt) {
      setVariantA(currentPrompt.version);
    }
  }, [agentName, currentPrompt]);

  async function handleCreate() {
    if (!variantA || !variantB) {
      alert('Please select both variants');
      return;
    }
    if (variantA === variantB) {
      alert('Variants must be different');
      return;
    }

    setSaving(true);

    const { error } = await supabase.from('prompt_ab_test').insert({
      agent_name: agentName,
      variant_a_version: variantA,
      variant_b_version: variantB,
      traffic_split: trafficSplit / 100,
      sample_size: sampleSize,
      name: name || null,
      status: 'draft',
    });

    setSaving(false);

    if (error) {
      alert('Failed to create test: ' + error.message);
    } else {
      onCreated();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-neutral-800 bg-neutral-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-white mb-4">Create A/B Test</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-neutral-400 mb-1">Test Name (optional)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Tagger mutual exclusivity test"
              className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-neutral-400 mb-1">Agent</label>
            <select
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-white"
            >
              {agents.map((agent) => (
                <option key={agent} value={agent}>
                  {agent}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-neutral-400 mb-1">
                Variant A <span className="text-emerald-400">(Control)</span>
              </label>
              <select
                value={variantA}
                onChange={(e) => setVariantA(e.target.value)}
                className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-white"
              >
                <option value="">Select version</option>
                {agentPrompts.map((p) => (
                  <option key={p.version} value={p.version}>
                    {p.version} {p.stage === 'PRD' ? '(live)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-neutral-400 mb-1">
                Variant B <span className="text-amber-400">(Challenger)</span>
              </label>
              <select
                value={variantB}
                onChange={(e) => setVariantB(e.target.value)}
                className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-white"
              >
                <option value="">Select version</option>
                {agentPrompts.map((p) => (
                  <option key={p.version} value={p.version}>
                    {p.version} {p.stage === 'PRD' ? '(live)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-neutral-400 mb-1">
                Traffic Split (Variant B %)
              </label>
              <input
                type="range"
                min="10"
                max="90"
                value={trafficSplit}
                onChange={(e) => setTrafficSplit(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-neutral-500 mt-1">
                <span>A: {100 - trafficSplit}%</span>
                <span>B: {trafficSplit}%</span>
              </div>
            </div>
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Sample Size</label>
              <input
                type="number"
                min="10"
                max="10000"
                value={sampleSize}
                onChange={(e) => setSampleSize(Number(e.target.value))}
                className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-white"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-400 hover:text-white">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create Test'}
          </button>
        </div>
      </div>
    </div>
  );
}
