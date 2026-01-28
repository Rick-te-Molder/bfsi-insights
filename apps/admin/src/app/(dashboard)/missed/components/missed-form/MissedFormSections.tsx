import type { FormModel, ExistingSource } from './types.shared';
import { ArticleAndSubmitterSections } from './MissedFormSections.ArticleAndSubmitter';
import { WhyAndActionsSections } from './MissedFormSections.WhyAndActions';

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
