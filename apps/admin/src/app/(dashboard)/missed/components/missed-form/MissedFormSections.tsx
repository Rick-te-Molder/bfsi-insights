import type { ExistingSource } from './types';
import type { SubmissionStatus } from '../../types';
import { ArticleAndSubmitterSections } from './MissedFormSections.ArticleAndSubmitter';
import { WhyAndActionsSections } from './MissedFormSections.WhyAndActions';

type FormModel = {
  status: SubmissionStatus;
  values: {
    url: string;
    submitterName: string;
    submitterChannel: string;
    submitterAudience: string;
    submitterUrgency: string;
    whyValuable: string;
    verbatimComment: string;
    suggestedAudiences: string[];
  };
  setters: {
    setUrl: (v: string) => void;
    setSubmitterName: (v: string) => void;
    setSubmitterChannel: (v: string) => void;
    setSubmitterAudience: (v: string) => void;
    setSubmitterUrgency: (v: string) => void;
    setWhyValuable: (v: string) => void;
    setVerbatimComment: (v: string) => void;
  };
  toggleAudience: (a: string) => void;
};

export function MissedFormSections({
  form,
  detectedDomain,
  existingSource,
}: Readonly<{
  form: FormModel;
  detectedDomain: string | null;
  existingSource: ExistingSource | null;
}>) {
  return (
    <>
      <ArticleAndSubmitterSections
        form={form}
        detectedDomain={detectedDomain}
        existingSource={existingSource}
      />
      <WhyAndActionsSections form={form} />
    </>
  );
}
