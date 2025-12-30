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
    const { error: updateError } = await supabase
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
      .eq('id', existingPub.id);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    publicationId = existingPub.id;

    const deleteResult = await deleteTaxonomyTags(supabase, publicationId);
    if (!deleteResult.success) {
      return deleteResult;
    }
  } else {
    const { data: pubData, error: pubError } = await supabase
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

    if (pubError || !pubData) {
      return { success: false, error: pubError?.message || 'Failed to publish' };
    }

    publicationId = pubData.id;
  }

  return { success: true, publicationId };
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
  const { data: taxonomyConfigs, error: taxonomyConfigError } = await supabase
    .from('taxonomy_config')
    .select('payload_field, junction_table, junction_code_column')
    .eq('is_active', true)
    .not('junction_table', 'is', null);

  if (taxonomyConfigError) {
    return { success: false, error: taxonomyConfigError.message };
  }

  for (const config of taxonomyConfigs || []) {
    const key = config.payload_field as string;
    if (!config.junction_table || !config.junction_code_column) continue;

    if (key === 'audience_scores') {
      const scores = payload[key] as Record<string, number> | undefined;
      if (scores && typeof scores === 'object') {
        const entries = Object.entries(scores).filter(([, score]) => score > 0);
        if (entries.length > 0) {
          const { error: insertError } = await supabase.from(config.junction_table).insert(
            entries.map(([code, score]) => ({
              publication_id: publicationId,
              [config.junction_code_column as string]: code,
              score,
            })),
          );
          if (insertError) {
            return { success: false, error: insertError.message };
          }
        }
      }
      continue;
    }

    const codes = payload[key] as string[] | undefined;
    if (!codes?.length) continue;

    const { error: insertError } = await supabase.from(config.junction_table).insert(
      codes.map((code: string) => ({
        publication_id: publicationId,
        [config.junction_code_column as string]: code,
      })),
    );

    if (insertError) {
      return { success: false, error: insertError.message };
    }
  }

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
