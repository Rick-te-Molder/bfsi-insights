import type { SupabaseClient } from '@supabase/supabase-js';
import type { ExistingSource } from './types';
import { submitMissedForm, validateMissedForm } from './submitMissedForm';
import type { SubmissionStatus } from '../../types';

type Values = {
  url: string;
  submitterName: string;
  submitterAudience: string;
  submitterChannel: string;
  submitterUrgency: string;
  whyValuable: string;
  verbatimComment: string;
  suggestedAudiences: string[];
};

function validateOrSetError(args: {
  values: Values;
  setStatus: (s: SubmissionStatus) => void;
  setMessage: (m: string) => void;
}) {
  const err = validateMissedForm({
    url: args.values.url,
    whyValuable: args.values.whyValuable,
    submitterAudience: args.values.submitterAudience,
  });

  if (!err) return { ok: true as const };
  args.setStatus('error');
  args.setMessage(err);
  return { ok: false as const };
}

async function runSubmit(args: {
  supabase: SupabaseClient;
  existingSource: ExistingSource | null;
  values: Values;
}) {
  return submitMissedForm({
    supabase: args.supabase,
    existingSource: args.existingSource,
    values: args.values,
  });
}

function applySubmitResult(args: {
  result: { ok: boolean; message: string };
  setStatus: (s: SubmissionStatus) => void;
  setMessage: (m: string) => void;
  reset: () => void;
  onSuccess: () => void;
}) {
  if (!args.result.ok) {
    args.setStatus('error');
    args.setMessage(args.result.message);
    return;
  }

  args.setStatus('success');
  args.setMessage(args.result.message);
  args.reset();
  args.onSuccess();
}

export async function executeMissedFormSubmit(args: {
  supabase: SupabaseClient;
  existingSource: ExistingSource | null;
  values: Values;
  setStatus: (s: SubmissionStatus) => void;
  setMessage: (m: string) => void;
  reset: () => void;
  onSuccess: () => void;
}) {
  const ok = validateOrSetError(args);
  if (!ok.ok) return;

  args.setStatus('submitting');
  args.setMessage('');

  try {
    const result = await runSubmit(args);
    applySubmitResult({
      result,
      setStatus: args.setStatus,
      setMessage: args.setMessage,
      reset: args.reset,
      onSuccess: args.onSuccess,
    });
  } catch (e2) {
    args.setStatus('error');
    args.setMessage(e2 instanceof Error ? e2.message : 'Failed to submit');
  }
}
