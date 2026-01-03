import { useCallback } from 'react';
import { buildMissedFormSetters } from './buildMissedFormSetters';
import { buildMissedFormValues } from './buildMissedFormValues';
import { resetMissedForm } from './resetMissedForm';
import { useArticleFields } from './useArticleFields';
import { useSuggestedAudiences } from './useSuggestedAudiences';
import { useSubmitterFields } from './useSubmitterFields';
import { useWhyFields } from './useWhyFields';

export type MissedFormValues = {
  url: string;
  submitterName: string;
  submitterAudience: string;
  submitterChannel: string;
  submitterUrgency: string;
  whyValuable: string;
  verbatimComment: string;
  suggestedAudiences: string[];
};

export function useMissedFormValues() {
  const article = useArticleFields();
  const submitter = useSubmitterFields();
  const why = useWhyFields();
  const suggested = useSuggestedAudiences();

  const setters = buildMissedFormSetters({ article, submitter, why, suggested });

  const reset = useCallback(() => {
    resetMissedForm(setters);
  }, [setters]);

  return {
    values: buildMissedFormValues({
      article,
      submitter,
      why,
      suggested,
    }) satisfies MissedFormValues,
    setters,
    reset,
    toggleAudience: suggested.toggleAudience,
  };
}
