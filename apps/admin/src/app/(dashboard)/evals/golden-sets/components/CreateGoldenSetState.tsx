'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { CreateGoldenSetFormData } from './CreateGoldenSetForm.types';

function useCreateGoldenSetState() {
  const [agentName, setAgentName] = useState('tagger');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [inputJson, setInputJson] = useState('{\n  "title": "",\n  "content": ""\n}');
  const [expectedJson, setExpectedJson] = useState(
    '{\n  "industry_codes": [],\n  "topic_codes": []\n}',
  );
  const [saving, setSaving] = useState(false);

  return {
    agentName,
    setAgentName,
    name,
    setName,
    description,
    setDescription,
    inputJson,
    setInputJson,
    expectedJson,
    setExpectedJson,
    saving,
    setSaving,
  };
}

function validateCreateForm(formData: CreateGoldenSetFormData) {
  if (!formData.name.trim()) {
    alert('Name is required');
    return false;
  }

  try {
    JSON.parse(formData.inputJson);
    JSON.parse(formData.expectedJson);
  } catch {
    alert('Invalid JSON in input or expected output');
    return false;
  }

  return true;
}

async function createGoldenSet(formData: CreateGoldenSetFormData) {
  const supabase = createClient();

  const input = JSON.parse(formData.inputJson);
  const expected = JSON.parse(formData.expectedJson);

  const { error } = await supabase.from('eval_golden_set').insert({
    agent_name: formData.agentName,
    name: formData.name,
    description: formData.description || null,
    input,
    expected_output: expected,
  });

  return error;
}

export { useCreateGoldenSetState, validateCreateForm, createGoldenSet };
