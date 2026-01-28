import { SupabaseClient } from '@supabase/supabase-js';

import type { PublicationData } from './publication-utils';

export async function upsertPublication(
  supabase: SupabaseClient,
  data: PublicationData,
): Promise<{ success: true; publicationId: string } | { success: false; error: string }> {
  const { data: existingPub } = await supabase
    .from('kb_publication')
    .select('id')
    .eq('source_url', data.sourceUrl)
    .single();

  let publicationId: string;

  if (existingPub) {
    const result = await updateExistingPublication(supabase, existingPub.id, data);
    if (!result.success) return result;
    publicationId = existingPub.id;

    const deleteResult = await deleteTaxonomyTags(supabase, publicationId);
    if (!deleteResult.success) return deleteResult;
  } else {
    const result = await insertNewPublication(supabase, data);
    if (!result.success) return result;
    publicationId = result.publicationId;
  }

  return { success: true, publicationId };
}

async function updateExistingPublication(
  supabase: SupabaseClient,
  id: string,
  data: PublicationData,
): Promise<{ success: true } | { success: false; error: string }> {
  const { error } = await supabase
    .from('kb_publication')
    .update({
      title: data.title,
      published_at: data.datePublished,
      summary_short: data.summaryShort,
      summary_medium: data.summaryMedium,
      summary_long: data.summaryLong,
      thumbnail: data.thumbnailUrl,
      thumbnail_bucket: data.thumbnailBucket,
      thumbnail_path: data.thumbnailPath,
      status: 'published',
      last_edited_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

async function insertNewPublication(
  supabase: SupabaseClient,
  data: PublicationData,
): Promise<{ success: true; publicationId: string } | { success: false; error: string }> {
  const { data: pubData, error } = await supabase
    .from('kb_publication')
    .insert({
      slug: data.slug,
      title: data.title,
      source_url: data.sourceUrl,
      source_name: data.sourceName,
      source_domain: data.sourceDomain,
      published_at: data.datePublished,
      summary_short: data.summaryShort,
      summary_medium: data.summaryMedium,
      summary_long: data.summaryLong,
      thumbnail: data.thumbnailUrl,
      thumbnail_bucket: data.thumbnailBucket,
      thumbnail_path: data.thumbnailPath,
      status: 'published',
    })
    .select('id')
    .single();

  if (error || !pubData) return { success: false, error: error?.message || 'Failed to publish' };
  return { success: true, publicationId: pubData.id };
}

async function deleteTaxonomyTags(
  supabase: SupabaseClient,
  publicationId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const { data: taxonomyConfigs } = await supabase
    .from('taxonomy_config')
    .select('junction_table')
    .eq('is_active', true)
    .not('junction_table', 'is', null);

  if (taxonomyConfigs) {
    for (const config of taxonomyConfigs) {
      if (config.junction_table) {
        await supabase.from(config.junction_table).delete().eq('publication_id', publicationId);
      }
    }
  }

  return { success: true };
}
