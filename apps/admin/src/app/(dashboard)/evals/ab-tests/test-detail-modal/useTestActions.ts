'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { PromptABTest } from '@/types/database';

type Supabase = ReturnType<typeof createClient>;

async function doUpdateStatus(supabase: Supabase, test: PromptABTest, newStatus: string) {
  const updates: Record<string, unknown> = { status: newStatus };
  if (newStatus === 'running' && !test.started_at) updates.started_at = new Date().toISOString();
  if (newStatus === 'completed' || newStatus === 'cancelled')
    updates.completed_at = new Date().toISOString();
  return supabase.from('prompt_ab_test').update(updates).eq('id', test.id);
}

async function doPromoteWinner(supabase: Supabase, test: PromptABTest, winner: 'a' | 'b') {
  const winnerVersion = winner === 'a' ? test.variant_a_version : test.variant_b_version;
  await supabase
    .from('prompt_version')
    .update({ stage: 'RET', retired_at: new Date().toISOString() })
    .eq('agent_name', test.agent_name)
    .eq('stage', 'PRD');
  const { error } = await supabase
    .from('prompt_version')
    .update({ stage: 'PRD', deployed_at: new Date().toISOString() })
    .eq('agent_name', test.agent_name)
    .eq('version', winnerVersion);
  await supabase.from('prompt_ab_test').update({ winner, status: 'completed' }).eq('id', test.id);
  return { error };
}

export function useTestActions(test: PromptABTest, onUpdate: () => void) {
  const [updating, setUpdating] = useState<string | null>(null);
  const supabase = createClient();

  const updateStatus = async (newStatus: string) => {
    setUpdating(newStatus);
    const { error } = await doUpdateStatus(supabase, test, newStatus);
    setUpdating(null);
    if (error) alert('Failed to update: ' + error.message);
    else onUpdate();
  };

  const promoteWinner = async (winner: 'a' | 'b') => {
    if (!confirm(`Promote Variant ${winner.toUpperCase()} as the current prompt?`)) return;
    setUpdating('promote');
    const { error } = await doPromoteWinner(supabase, test, winner);
    setUpdating(null);
    if (error) alert('Failed to promote: ' + error.message);
    else onUpdate();
  };

  return { updating, updateStatus, promoteWinner };
}
