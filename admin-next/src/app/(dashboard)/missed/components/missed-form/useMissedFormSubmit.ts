import { useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ExistingSource } from './types';
import { executeMissedFormSubmit } from './executeMissedFormSubmit';
import type { SubmissionStatus } from '../../types';

export function useMissedFormSubmit(args: {
  supabase: SupabaseClient;
  existingSource: ExistingSource | null;
  onSuccess: () => void;
  reset: () => void;
  setStatus: (s: SubmissionStatus) => void;
  setMessage: (m: string) => void;
  values: {
    url: string;
    submitterName: string;
    submitterAudience: string;
    submitterChannel: string;
    submitterUrgency: string;
    whyValuable: string;
    verbatimComment: string;
    suggestedAudiences: string[];
  };
}) {
  return useCallback(async () => {
    await executeMissedFormSubmit({
      supabase: args.supabase,
      existingSource: args.existingSource,
      values: args.values,
      setStatus: args.setStatus,
      setMessage: args.setMessage,
      reset: args.reset,
      onSuccess: args.onSuccess,
    });
  }, [args]);
}
