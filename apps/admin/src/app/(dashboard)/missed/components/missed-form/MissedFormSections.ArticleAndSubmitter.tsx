import type { ExistingSource } from './types';
import {
  ArticleSectionBlock,
  SubmitterSectionBlock,
} from './MissedFormSections.ArticleAndSubmitter.parts';

type FormModel = {
  values: {
    url: string;
    submitterName: string;
    submitterChannel: string;
    submitterAudience: string;
    submitterUrgency: string;
  };
  setters: {
    setUrl: (v: string) => void;
    setSubmitterName: (v: string) => void;
    setSubmitterChannel: (v: string) => void;
    setSubmitterAudience: (v: string) => void;
    setSubmitterUrgency: (v: string) => void;
  };
};

export function ArticleAndSubmitterSections({
  form,
  detectedDomain,
  existingSource,
}: {
  form: FormModel;
  detectedDomain: string | null;
  existingSource: ExistingSource | null;
}) {
  return (
    <>
      <ArticleSectionBlock
        form={form}
        detectedDomain={detectedDomain}
        existingSource={existingSource}
      />
      <SubmitterSectionBlock form={form} />
    </>
  );
}
