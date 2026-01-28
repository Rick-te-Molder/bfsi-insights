import type { FormEvent } from 'react';
import type { FormModel, ExistingSource } from './types.shared';
import { StatusBanner } from './StatusBanner';
import { MissedFormSections } from './MissedFormSections';

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
      <StatusBanner status={form.status} message={form.message || ''} />
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
