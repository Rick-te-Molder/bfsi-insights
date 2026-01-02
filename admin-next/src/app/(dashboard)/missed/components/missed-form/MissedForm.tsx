import { MissedFormView } from './MissedFormView';
import { useMissedFormController } from './useMissedFormController';

interface MissedFormProps {
  onSuccess: () => void;
}

export function MissedForm({ onSuccess }: MissedFormProps) {
  const { form, detectedDomain, existingSource, onSubmit } = useMissedFormController(onSuccess);

  return (
    <MissedFormView
      form={form}
      detectedDomain={detectedDomain}
      existingSource={existingSource}
      onSubmit={onSubmit}
    />
  );
}
