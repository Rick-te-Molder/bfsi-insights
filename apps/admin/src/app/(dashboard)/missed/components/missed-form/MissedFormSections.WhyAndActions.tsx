import { AUDIENCES } from '../../constants';
import type { SubmissionStatus } from '../../types';
import { ClassificationSection } from './ClassificationSection';
import { FormActions } from './FormActions';
import { WhySection } from './WhySection';

type FormModel = {
  status: SubmissionStatus;
  values: {
    whyValuable: string;
    verbatimComment: string;
    suggestedAudiences: string[];
  };
  setters: {
    setWhyValuable: (v: string) => void;
    setVerbatimComment: (v: string) => void;
  };
  toggleAudience: (a: string) => void;
};

export function WhyAndActionsSections({ form }: Readonly<{ form: FormModel }>) {
  return (
    <>
      <WhySection
        whyValuable={form.values.whyValuable}
        setWhyValuable={form.setters.setWhyValuable}
        verbatimComment={form.values.verbatimComment}
        setVerbatimComment={form.setters.setVerbatimComment}
      />
      <ClassificationSection
        audiences={AUDIENCES}
        suggestedAudiences={form.values.suggestedAudiences}
        toggleAudience={form.toggleAudience}
      />
      <FormActions status={form.status} />
    </>
  );
}
