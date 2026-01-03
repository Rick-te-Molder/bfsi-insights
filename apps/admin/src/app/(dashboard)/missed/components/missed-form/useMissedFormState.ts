import { useMissedFormValues } from './useMissedFormValues';
import { useSubmissionFeedback } from './useSubmissionFeedback';

export function useMissedFormState() {
  const values = useMissedFormValues();
  const feedback = useSubmissionFeedback();

  return {
    values: values.values,
    setters: values.setters,
    reset: values.reset,
    toggleAudience: values.toggleAudience,
    status: feedback.status,
    setStatus: feedback.setStatus,
    message: feedback.message,
    setMessage: feedback.setMessage,
  };
}
