import { SupabaseClient } from '@supabase/supabase-js';

import { resolveEntityIdsForTaxonomy } from './entity-name-resolvers';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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
  const key = config.payload_field;
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
    return handleAudienceScores(supabase, config, publicationId, payload);
  return handleCodesArray(supabase, config, publicationId, payload, key);
}

async function fetchTaxonomyConfigs(supabase: SupabaseClient) {
  return supabase
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
  const rawScores = payload[config.payload_field];
  if (!isRecord(rawScores)) return { success: true };

  const entries = Object.entries(rawScores)
    .map(([code, score]) => ({ code, score }))
    .filter(
      (e): e is { code: string; score: number } => typeof e.score === 'number' && e.score > 0,
    );
  if (entries.length === 0) return { success: true };

  const { error } = await supabase.from(config.junction_table).insert(
    entries.map(({ code, score }) => ({
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
  const raw = payload[key];
  if (!Array.isArray(raw)) return { success: true };
  const codes = raw.filter((v): v is string => typeof v === 'string' && v.length > 0);
  if (codes.length === 0) return { success: true };

  const { error } = await supabase.from(config.junction_table).insert(
    codes.map((code) => ({
      publication_id: publicationId,
      [config.junction_code_column]: code,
    })),
  );

  if (error) return { success: false, error: error.message };
  return { success: true };
}
