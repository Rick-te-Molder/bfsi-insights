import { SupabaseClient } from '@supabase/supabase-js';

export interface PublicationData {
  title: string;
  slug: string;
  sourceUrl: string;
  sourceName: string;
  sourceDomain: string;
  datePublished: string;
  summaryShort: string;
  summaryMedium: string;
  summaryLong: string;
  thumbnailUrl: string | null;
  thumbnailBucket: string | null;
  thumbnailPath: string | null;
}

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
      date_published: data.datePublished,
      summary_short: data.summaryShort,
      summary_medium: data.summaryMedium,
      summary_long: data.summaryLong,
      thumbnail: data.thumbnailUrl,
      thumbnail_bucket: data.thumbnailBucket,
      thumbnail_path: data.thumbnailPath,
      last_edited: new Date().toISOString(),
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
      date_published: data.datePublished,
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

export async function insertTaxonomyTags(
  supabase: SupabaseClient,
  publicationId: string,
  payload: Record<string, unknown>,
): Promise<{ success: true } | { success: false; error: string }> {
  const { data: taxonomyConfigs, error: taxonomyConfigError } =
    await fetchTaxonomyConfigs(supabase);
  if (taxonomyConfigError) return { success: false, error: taxonomyConfigError.message };

  for (const config of taxonomyConfigs || []) {
    const key = config.payload_field as string;
    if (!config.junction_table || !config.junction_code_column) continue;

    if (key === 'audience_scores') {
      const result = await handleAudienceScores(supabase, config, publicationId, payload);
      if (!result.success) return result;
      continue;
    }

    const result = await handleCodesArray(supabase, config, publicationId, payload, key);
    if (!result.success) return result;
  }

  return { success: true };
}

async function fetchTaxonomyConfigs(supabase: SupabaseClient) {
  return await supabase
    .from('taxonomy_config')
    .select('payload_field, junction_table, junction_code_column')
    .eq('is_active', true)
    .not('junction_table', 'is', null);
}

async function handleAudienceScores(
  supabase: SupabaseClient,
  config: { payload_field: string; junction_table: string; junction_code_column: string },
  publicationId: string,
  payload: Record<string, unknown>,
): Promise<{ success: true } | { success: false; error: string }> {
  const scores = payload[config.payload_field] as Record<string, number> | undefined;
  if (!scores || typeof scores !== 'object') return { success: true };

  const entries = Object.entries(scores).filter(([, score]) => score > 0);
  if (entries.length === 0) return { success: true };

  const { error } = await supabase.from(config.junction_table).insert(
    entries.map(([code, score]) => ({
      publication_id: publicationId,
      [config.junction_code_column]: code,
      score,
    })),
  );

  if (error) return { success: false, error: error.message };
  return { success: true };
}

async function handleCodesArray(
  supabase: SupabaseClient,
  config: { payload_field: string; junction_table: string; junction_code_column: string },
  publicationId: string,
  payload: Record<string, unknown>,
  key: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const codes = payload[key] as string[] | undefined;
  if (!codes?.length) return { success: true };

  const { error } = await supabase.from(config.junction_table).insert(
    codes.map((code: string) => ({
      publication_id: publicationId,
      [config.junction_code_column]: code,
    })),
  );

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}

export function buildPublicStorageUrl(bucket?: string | null, path?: string | null): string | null {
  if (!bucket || !path) return null;
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) return null;
  return `${baseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export function preparePublicationData(
  item: { url: string; payload: Record<string, unknown> },
  title: string,
): PublicationData {
  const payload = item.payload || {};
  const summary = (payload.summary || {}) as Record<string, unknown>;
  const sourceDomain = extractDomain(item.url);
  const sourceFromPayload = (payload.source_name || payload.source || payload.source_slug) as
    | string
    | undefined;

  const thumbnailBucket = (payload.thumbnail_bucket as string | null | undefined) ?? null;
  const thumbnailPath = (payload.thumbnail_path as string | null | undefined) ?? null;
  const thumbnailUrl =
    (payload.thumbnail_url as string | null | undefined) ??
    buildPublicStorageUrl(thumbnailBucket, thumbnailPath) ??
    null;

  return {
    title,
    slug: `${generateSlug(title)}-${Date.now()}`,
    sourceUrl: item.url,
    sourceName:
      sourceFromPayload && sourceFromPayload !== 'manual' ? sourceFromPayload : sourceDomain,
    sourceDomain,
    datePublished: (payload.published_at as string) || new Date().toISOString(),
    summaryShort: (summary.short as string) || '',
    summaryMedium: (summary.medium as string) || '',
    summaryLong: (summary.long as string) || '',
    thumbnailUrl,
    thumbnailBucket,
    thumbnailPath,
  };
}
