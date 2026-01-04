'use client';

import type { Source } from '@/types/database';

type FormData = Partial<Source>;
type SetFormData = React.Dispatch<React.SetStateAction<FormData>>;

const inputClass =
  'w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-white';
const labelClass = 'block text-sm text-neutral-400 mb-1';

const CATEGORIES = [
  { value: 'regulator', label: 'Regulator' },
  { value: 'central_bank', label: 'Central Bank' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'research', label: 'Research' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'media_outlet', label: 'Media Outlet' },
  { value: 'standards_body', label: 'Standards Body' },
  { value: 'academic', label: 'Academic' },
  { value: 'government_body', label: 'Government Body' },
];

function CategorySelect({
  formData,
  setFormData,
}: Readonly<{
  formData: FormData;
  setFormData: SetFormData;
}>) {
  return (
    <div>
      <label htmlFor="sourceCategory" className={labelClass}>
        Category
      </label>
      <select
        id="sourceCategory"
        value={formData.category || ''}
        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
        className={inputClass}
      >
        {CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function TierSelect({
  formData,
  setFormData,
}: Readonly<{ formData: FormData; setFormData: SetFormData }>) {
  return (
    <div>
      <label htmlFor="sourceTier" className={labelClass}>
        Tier
      </label>
      <select
        id="sourceTier"
        value={formData.tier || 'standard'}
        onChange={(e) =>
          setFormData({ ...formData, tier: e.target.value as 'standard' | 'premium' })
        }
        className={inputClass}
      >
        <option value="standard">Standard</option>
        <option value="premium">Premium</option>
      </select>
    </div>
  );
}

export function CategoryTierFields({
  formData,
  setFormData,
}: Readonly<{
  formData: FormData;
  setFormData: SetFormData;
}>) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <CategorySelect formData={formData} setFormData={setFormData} />
      <TierSelect formData={formData} setFormData={setFormData} />
    </div>
  );
}

export type { FormData, SetFormData };
