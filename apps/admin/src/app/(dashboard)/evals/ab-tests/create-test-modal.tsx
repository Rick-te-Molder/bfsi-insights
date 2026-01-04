'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { PromptVersion } from '@/types/database';
import { ModalContent } from './components/modal-content';
import { ModalWrapper } from './components/modal-wrapper';

interface CreateTestModalProps {
  agents: string[];
  prompts: PromptVersion[];
  onClose: () => void;
  onCreated: () => void;
}

function useTestFormState(agents: string[], prompts: PromptVersion[]) {
  const [agentName, setAgentName] = useState(agents[0] || '');
  const [variantA, setVariantA] = useState('');
  const [variantB, setVariantB] = useState('');
  const [trafficSplit, setTrafficSplit] = useState(50);
  const [sampleSize, setSampleSize] = useState(100);
  const [name, setName] = useState('');
  const agentPrompts = prompts.filter((p) => p.agent_name === agentName);
  const currentPrompt = agentPrompts.find((p) => p.stage === 'PRD');
  useEffect(() => {
    if (currentPrompt) setVariantA(currentPrompt.version);
  }, [agentName, currentPrompt]);
  return {
    agentName,
    setAgentName,
    variantA,
    setVariantA,
    variantB,
    setVariantB,
    trafficSplit,
    setTrafficSplit,
    sampleSize,
    setSampleSize,
    name,
    setName,
    agentPrompts,
  };
}

function useCreateHandler(state: ReturnType<typeof useTestFormState>, onCreated: () => void) {
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  async function handleCreate() {
    if (!state.variantA || !state.variantB) {
      alert('Please select both variants');
      return;
    }
    if (state.variantA === state.variantB) {
      alert('Variants must be different');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('prompt_ab_test').insert({
      agent_name: state.agentName,
      variant_a_version: state.variantA,
      variant_b_version: state.variantB,
      traffic_split: state.trafficSplit / 100,
      sample_size: state.sampleSize,
      name: state.name || null,
      status: 'draft',
    });
    setSaving(false);
    if (error) alert('Failed to create test: ' + error.message);
    else onCreated();
  }

  return { saving, handleCreate };
}

export function CreateTestModal({ agents, prompts, onClose, onCreated }: CreateTestModalProps) {
  const state = useTestFormState(agents, prompts);
  const { saving, handleCreate } = useCreateHandler(state, onCreated);

  return (
    <ModalWrapper onClose={onClose}>
      <ModalContent
        {...state}
        agents={agents}
        onClose={onClose}
        onCreate={handleCreate}
        saving={saving}
      />
    </ModalWrapper>
  );
}
