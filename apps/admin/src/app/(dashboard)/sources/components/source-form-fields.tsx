'use client';

import type { Source } from '@/types/database';

type FormData = Partial<Source>;
type SetFormData = React.Dispatch<React.SetStateAction<FormData>>;

const inputClass =
  'w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-white';
const labelClass = 'block text-sm text-neutral-400 mb-1';

function NameField({ formData, setFormData }: { formData: FormData; setFormData: SetFormData }) {
  return (
    <div>
      <label htmlFor="sourceName" className={labelClass}>
        Name
      </label>
      <input
        id="sourceName"
        type="text"
        value={formData.name || ''}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        className={inputClass}
        required
      />
    </div>
  );
}

function SlugField({
  formData,
  setFormData,
  disabled,
}: {
  formData: FormData;
  setFormData: SetFormData;
  disabled: boolean;
}) {
  return (
    <div>
      <label htmlFor="sourceSlug" className={labelClass}>
        Slug
      </label>
      <input
        id="sourceSlug"
        type="text"
        value={formData.slug || ''}
        onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
        className={inputClass}
        required
        disabled={disabled}
      />
    </div>
  );
}

export function NameSlugFields({
  formData,
  setFormData,
  isEdit,
}: {
  formData: FormData;
  setFormData: SetFormData;
  isEdit: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <NameField formData={formData} setFormData={setFormData} />
      <SlugField formData={formData} setFormData={setFormData} disabled={isEdit} />
    </div>
  );
}

export function DomainField({
  formData,
  setFormData,
}: {
  formData: FormData;
  setFormData: SetFormData;
}) {
  return (
    <div>
      <label htmlFor="sourceDomain" className={labelClass}>
        Domain
      </label>
      <input
        id="sourceDomain"
        type="text"
        value={formData.domain || ''}
        onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
        className={inputClass}
        placeholder="example.com"
      />
    </div>
  );
}

export { CategoryTierFields } from './source-form-selects';

function RssField({ formData, setFormData }: { formData: FormData; setFormData: SetFormData }) {
  return (
    <div>
      <label htmlFor="sourceRss" className={labelClass}>
        RSS Feed URL
      </label>
      <input
        id="sourceRss"
        type="text"
        value={formData.rss_feed || ''}
        onChange={(e) => setFormData({ ...formData, rss_feed: e.target.value })}
        className={inputClass}
        placeholder="https://..."
      />
    </div>
  );
}

function SitemapField({ formData, setFormData }: { formData: FormData; setFormData: SetFormData }) {
  return (
    <div>
      <label htmlFor="sourceSitemap" className={labelClass}>
        Sitemap URL
      </label>
      <input
        id="sourceSitemap"
        type="text"
        value={formData.sitemap_url || ''}
        onChange={(e) => setFormData({ ...formData, sitemap_url: e.target.value })}
        className={inputClass}
        placeholder="https://..."
      />
    </div>
  );
}

export function UrlFields({
  formData,
  setFormData,
}: {
  formData: FormData;
  setFormData: SetFormData;
}) {
  return (
    <>
      <RssField formData={formData} setFormData={setFormData} />
      <SitemapField formData={formData} setFormData={setFormData} />
    </>
  );
}

export function PriorityField({
  formData,
  setFormData,
}: {
  formData: FormData;
  setFormData: SetFormData;
}) {
  return (
    <div>
      <label htmlFor="sourcePriority" className={labelClass}>
        Priority (sort order)
      </label>
      <input
        id="sourcePriority"
        type="number"
        value={formData.sort_order || 500}
        onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) })}
        className={inputClass}
      />
    </div>
  );
}

export function CheckboxFields({
  formData,
  setFormData,
}: {
  formData: FormData;
  setFormData: SetFormData;
}) {
  return (
    <div className="flex items-center gap-4">
      <label className="flex items-center gap-2 text-sm text-neutral-400">
        <input
          type="checkbox"
          checked={formData.enabled || false}
          onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
          className="rounded border-neutral-700 bg-neutral-800"
        />
        Enabled
      </label>
      <label className="flex items-center gap-2 text-sm text-neutral-400">
        <input
          type="checkbox"
          checked={formData.show_on_external_page || false}
          onChange={(e) => setFormData({ ...formData, show_on_external_page: e.target.checked })}
          className="rounded border-neutral-700 bg-neutral-800"
        />
        Show on external page
      </label>
    </div>
  );
}

export function FormFooter({ onClose, saving }: { onClose: () => void; saving: boolean }) {
  return (
    <div className="flex justify-end gap-3 pt-4 border-t border-neutral-800">
      <button
        type="button"
        onClick={onClose}
        className="rounded-md px-4 py-2 text-sm text-neutral-400 hover:text-white"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  );
}

export const defaultFormData: FormData = {
  name: '',
  slug: '',
  domain: '',
  category: 'vendor',
  tier: 'standard',
  enabled: true,
  sort_order: 500,
  rss_feed: '',
  sitemap_url: '',
  description: '',
  show_on_external_page: false,
};

export type { FormData, SetFormData };
