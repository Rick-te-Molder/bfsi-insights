import type { SupabaseClient } from '@supabase/supabase-js';
import type { ExistingSource } from './types';

export async function fetchExistingSource(supabase: SupabaseClient, domain: string) {
  const { data } = await supabase
    .from('kb_source')
    .select('slug, name')
    .ilike('domain', `%${domain}%`)
    .limit(1);

  if (!data || data.length === 0) return null;
  return { slug: data[0].slug, name: data[0].name ?? null } satisfies ExistingSource;
}
