import { createClient } from '@/lib/supabase/client';
import type { PromptVersion } from '@/types/database';

type PromotionPlan = {
  nextStage: string;
  message: string;
};

function getPromotionPlan(stage: string, version: string): PromotionPlan | null {
  if (stage === 'DEV') {
    return { nextStage: 'TST', message: `Promote "${version}" to TEST?` };
  }

  if (stage === 'TST') {
    return {
      nextStage: 'PRD',
      message: `Promote "${version}" to PRODUCTION? This will retire the current PRD version.`,
    };
  }

  return null;
}

type SupabaseClient = ReturnType<typeof createClient>;

async function retireCurrentPrd(supabase: SupabaseClient, agentName: string) {
  return supabase
    .from('prompt_version')
    .update({ stage: 'RET', retired_at: new Date().toISOString() })
    .eq('agent_name', agentName)
    .eq('stage', 'PRD');
}

async function promotePrompt(
  supabase: SupabaseClient,
  promptId: string,
  updates: Record<string, unknown>,
) {
  return supabase.from('prompt_version').update(updates).eq('id', promptId);
}

async function promoteToStage(
  supabase: SupabaseClient,
  promptId: string,
  stage: string,
  onUpdate: () => void,
) {
  const { error } = await promotePrompt(supabase, promptId, { stage });
  if (error) {
    alert('Failed to promote: ' + error.message);
    return;
  }
  onUpdate();
}

async function promoteToPrd(
  supabase: SupabaseClient,
  agentName: string,
  promptId: string,
  onUpdate: () => void,
) {
  const { error: retireError } = await retireCurrentPrd(supabase, agentName);
  if (retireError) {
    alert('Failed to retire old PRD: ' + retireError.message);
    return;
  }

  const { error } = await promotePrompt(supabase, promptId, {
    stage: 'PRD',
    deployed_at: new Date().toISOString(),
  });

  if (error) {
    alert('Failed to promote: ' + error.message);
    return;
  }

  onUpdate();
}

function createDeleteVersion(supabase: SupabaseClient, onUpdate: () => void) {
  return async (prompt: PromptVersion) => {
    if (!confirm(`Delete version "${prompt.version}"? This cannot be undone.`)) {
      return;
    }

    const { error } = await supabase.from('prompt_version').delete().eq('id', prompt.id);

    if (error) {
      alert('Failed to delete version: ' + error.message);
    } else {
      onUpdate();
    }
  };
}

function createPromoteVersion(supabase: SupabaseClient, agentName: string, onUpdate: () => void) {
  return async (prompt: PromptVersion) => {
    const stage = prompt.stage as string;
    const plan = getPromotionPlan(stage, prompt.version);
    if (!plan) return;
    if (!confirm(plan.message)) return;

    if (plan.nextStage === 'PRD') {
      await promoteToPrd(supabase, agentName, prompt.id, onUpdate);
      return;
    }

    await promoteToStage(supabase, prompt.id, plan.nextStage, onUpdate);
  };
}

export function usePromptActions(agentName: string, onUpdate: () => void) {
  const supabase = createClient();

  const deleteVersion = createDeleteVersion(supabase, onUpdate);
  const promoteVersion = createPromoteVersion(supabase, agentName, onUpdate);

  return { deleteVersion, promoteVersion };
}
