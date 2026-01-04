import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Source } from '@/types/database';
import type { FormData } from '../components/source-form-fields';

function prepareDataToSave(formData: FormData) {
  return {
    ...formData,
    rss_feed: formData.rss_feed || null,
    sitemap_url: formData.sitemap_url || null,
    description: formData.description || null,
  };
}

/**
 * Handles the submit logic for the source modal form.
 */
export function useSourceModalSubmit(
  source: Source | null,
  formData: FormData,
  onSave: () => void,
) {
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const dataToSave = prepareDataToSave(formData);
    const { error } = source
      ? await supabase.from('kb_source').update(dataToSave).eq('slug', source.slug)
      : await supabase.from('kb_source').insert(dataToSave);
    setSaving(false);
    if (error) alert('Failed to save: ' + error.message);
    else onSave();
  }

  return { saving, handleSubmit };
}
