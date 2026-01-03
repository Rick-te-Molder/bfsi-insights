import { createClient } from '@/lib/supabase/client';
import type { PromptVersion } from '@/types/database';

export function usePromptActions(agentName: string, onUpdate: () => void) {
  const supabase = createClient();

  async function deleteVersion(prompt: PromptVersion) {
    if (!confirm(`Delete version "${prompt.version}"? This cannot be undone.`)) {
      return;
    }

    const { error } = await supabase.from('prompt_version').delete().eq('id', prompt.id);

    if (error) {
      alert('Failed to delete version: ' + error.message);
    } else {
      onUpdate();
    }
  }

  async function promoteVersion(prompt: PromptVersion) {
    const stage = prompt.stage as string;
    let nextStage: string;
    let message: string;

    if (stage === 'DEV') {
      nextStage = 'TST';
      message = `Promote "${prompt.version}" to TEST?`;
    } else if (stage === 'TST') {
      nextStage = 'PRD';
      message = `Promote "${prompt.version}" to PRODUCTION? This will retire the current PRD version.`;
    } else {
      return;
    }

    if (!confirm(message)) return;

    if (nextStage === 'PRD') {
      const { error: retireError } = await supabase
        .from('prompt_version')
        .update({ stage: 'RET', retired_at: new Date().toISOString() })
        .eq('agent_name', agentName)
        .eq('stage', 'PRD');

      if (retireError) {
        alert('Failed to retire old PRD: ' + retireError.message);
        return;
      }

      const { error } = await supabase
        .from('prompt_version')
        .update({ stage: nextStage, deployed_at: new Date().toISOString() })
        .eq('id', prompt.id);

      if (error) {
        alert('Failed to promote: ' + error.message);
      } else {
        onUpdate();
      }
    } else {
      const { error } = await supabase
        .from('prompt_version')
        .update({ stage: nextStage })
        .eq('id', prompt.id);

      if (error) {
        alert('Failed to promote: ' + error.message);
      } else {
        onUpdate();
      }
    }
  }

  return { deleteVersion, promoteVersion };
}
