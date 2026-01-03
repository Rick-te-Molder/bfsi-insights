import { AUDIENCES, CHANNELS, URGENCY_OPTIONS } from '../../constants';
import type { ExistingSource } from './types';
import { ArticleSection } from './ArticleSection';
import { SubmitterSection } from './SubmitterSection';

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

export function ArticleSectionBlock({
  form,
  detectedDomain,
  existingSource,
}: {
  form: FormModel;
  detectedDomain: string | null;
  existingSource: ExistingSource | null;
}) {
  return (
    <ArticleSection
      url={form.values.url}
      setUrl={form.setters.setUrl}
      detectedDomain={detectedDomain}
      existingSource={existingSource}
    />
  );
}

export function SubmitterSectionBlock({ form }: { form: FormModel }) {
  return (
    <SubmitterSection
      submitterName={form.values.submitterName}
      setSubmitterName={form.setters.setSubmitterName}
      submitterChannel={form.values.submitterChannel}
      setSubmitterChannel={form.setters.setSubmitterChannel}
      submitterAudience={form.values.submitterAudience}
      setSubmitterAudience={form.setters.setSubmitterAudience}
      submitterUrgency={form.values.submitterUrgency}
      setSubmitterUrgency={form.setters.setSubmitterUrgency}
      audiences={AUDIENCES}
      channels={CHANNELS}
      urgencyOptions={URGENCY_OPTIONS}
    />
  );
}
