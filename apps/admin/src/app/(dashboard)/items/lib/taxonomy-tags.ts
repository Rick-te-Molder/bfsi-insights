import { SupabaseClient } from '@supabase/supabase-js';

import { resolveEntityIdsForTaxonomy } from './entity-name-resolvers';

export async function insertTaxonomyTags(
  supabase: SupabaseClient,
  publicationId: string,
  payload: Record<string, unknown>,
): Promise<{ success: true } | { success: false; error: string }> {
  const { data: taxonomyConfigs, error: taxonomyConfigError } =
    await fetchTaxonomyConfigs(supabase);
  if (taxonomyConfigError) return { success: false, error: taxonomyConfigError.message };

  for (const config of taxonomyConfigs || []) {
    const result = await insertOneTaxonomyConfig(supabase, publicationId, payload, config);
    if (!result.success) return result;
  }

  return { success: true };
}

async function insertOneTaxonomyConfig(
  supabase: SupabaseClient,
  publicationId: string,
  payload: Record<string, unknown>,
  config: { payload_field: string; junction_table: string; junction_code_column: string },
): Promise<{ success: true } | { success: false; error: string }> {
  const key = config.payload_field as string;
  if (!config.junction_table || !config.junction_code_column) return { success: true };

  const entityInsertResult = await insertResolvedEntityJunctionRows({
    supabase,
    publicationId,
    payload,
    config,
    payloadField: key,
  });
  if (!entityInsertResult.success) return entityInsertResult;
  if (entityInsertResult.didHandle) return { success: true };

  if (key === 'audience_scores')
    return await handleAudienceScores(supabase, config, publicationId, payload);
  return await handleCodesArray(supabase, config, publicationId, payload, key);
}

async function fetchTaxonomyConfigs(supabase: SupabaseClient) {
  return await supabase
    .from('taxonomy_config')
    .select('payload_field, junction_table, junction_code_column')
    .eq('is_active', true)
    .not('junction_table', 'is', null);
}

async function insertResolvedEntityJunctionRows(args: {
  supabase: SupabaseClient;
  publicationId: string;
  payload: Record<string, unknown>;
  payloadField: string;
  config: { payload_field: string; junction_table: string; junction_code_column: string };
}): Promise<{ success: true; didHandle: boolean } | { success: false; error: string }> {
  const resolvedEntityIds = await resolveEntityIdsForTaxonomy({
    supabase: args.supabase,
    payload: args.payload,
    payloadField: args.payloadField,
  });
  if (!resolvedEntityIds) return { success: true, didHandle: false };
  if (resolvedEntityIds.length === 0) return { success: true, didHandle: true };

  const { error } = await args.supabase.from(args.config.junction_table).insert(
    resolvedEntityIds.map((id) => ({
      publication_id: args.publicationId,
      [args.config.junction_code_column]: id,
    })),
  );
  if (error) return { success: false, error: error.message };

  return { success: true, didHandle: true };
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
