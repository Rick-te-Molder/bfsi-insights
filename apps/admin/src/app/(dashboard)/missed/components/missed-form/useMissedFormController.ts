import { useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useMissedFormState } from './useMissedFormState';
import { useMissedFormSubmit } from './useMissedFormSubmit';
import { useSubmissionHandler } from './useSubmissionHandler';
import { useUrlSource } from './useUrlSource';

export function useMissedFormController(onSuccess: () => void) {
  const form = useMissedFormState();
  const supabase = useMemo(() => createClient(), []);
  const { detectedDomain, existingSource } = useUrlSource(form.values.url, supabase);

  const doSubmit = useMissedFormSubmit({
    supabase,
    existingSource,
    onSuccess,
    reset: form.reset,
    setStatus: form.setStatus,
    setMessage: form.setMessage,
    values: form.values,
  });

  const onSubmit = useSubmissionHandler({ doSubmit });

  return { form, detectedDomain, existingSource, onSubmit };
}
