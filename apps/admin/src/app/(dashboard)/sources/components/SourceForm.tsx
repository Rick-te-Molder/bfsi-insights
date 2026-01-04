'use client';

import {
  NameSlugFields,
  DomainField,
  CategoryTierFields,
  UrlFields,
  PriorityField,
  CheckboxFields,
  FormFooter,
  type FormData,
  type SetFormData,
} from './source-form-fields';

interface SourceFormProps {
  formData: FormData;
  setFormData: SetFormData;
  isEdit: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  saving: boolean;
}

export function SourceForm({
  formData,
  setFormData,
  isEdit,
  onSubmit,
  onClose,
  saving,
}: Readonly<SourceFormProps>) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <NameSlugFields formData={formData} setFormData={setFormData} isEdit={isEdit} />
      <DomainField formData={formData} setFormData={setFormData} />
      <CategoryTierFields formData={formData} setFormData={setFormData} />
      <UrlFields formData={formData} setFormData={setFormData} />
      <PriorityField formData={formData} setFormData={setFormData} />
      <CheckboxFields formData={formData} setFormData={setFormData} />
      <FormFooter onClose={onClose} saving={saving} />
    </form>
  );
}
