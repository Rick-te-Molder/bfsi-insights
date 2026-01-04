import type { FormEvent } from 'react';
import type { SubmissionStatus } from '../../types';
import type { ExistingSource } from './types';
import { StatusBanner } from './StatusBanner';
import { MissedFormSections } from './MissedFormSections';

type FormModel = {
  status: SubmissionStatus;
  message: string;
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

type Props = {
  form: FormModel;
  detectedDomain: string | null;
  existingSource: ExistingSource | null;
  onSubmit: (e: FormEvent) => void;
};

export function MissedFormView({
  form,
  detectedDomain,
  existingSource,
  onSubmit,
}: Readonly<Props>) {
  return (
    <div className="max-w-2xl">
      <StatusBanner status={form.status} message={form.message} />
      <form onSubmit={onSubmit} className="space-y-6">
        <MissedFormSections
          form={form}
          detectedDomain={detectedDomain}
          existingSource={existingSource}
        />
      </form>
    </div>
  );
}
