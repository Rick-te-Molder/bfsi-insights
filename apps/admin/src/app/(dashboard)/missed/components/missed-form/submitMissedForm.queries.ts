import type { SupabaseClient } from '@supabase/supabase-js';

type MissedDiscoveryInsertRow = {
  url: string;
  url_norm: string;
  submitter_name: string | null;
  submitter_type: 'client';
  submitter_audience: string;
  submitter_channel: string;
  submitter_urgency: string;
  why_valuable: string;
  verbatim_comment: string | null;
  suggested_audiences: string[] | null;
  source_domain: string;
  existing_source_slug: string | null;
};

type IngestionQueueInsertRow = {
  url: string;
  url_norm: string;
  source: string;
  status: 'pending';
  status_code: number;
  payload: {
    manual_add: true;
    submitter: string | null;
    why_valuable: string;
  };
};

export async function isDuplicateMissedDiscovery(supabase: SupabaseClient, urlNorm: string) {
  const { data: existing } = await supabase
    .from('missed_discovery')
    .select('id')
    .eq('url_norm', urlNorm)
    .maybeSingle();

  return Boolean(existing);
}

export async function insertMissedDiscovery(
  supabase: SupabaseClient,
  row: MissedDiscoveryInsertRow,
) {
  const { error } = await supabase.from('missed_discovery').insert(row);
  if (error) throw error;
}

export async function insertIngestionQueue(supabase: SupabaseClient, row: IngestionQueueInsertRow) {
  const { error } = await supabase.from('ingestion_queue').insert(row);
  if (error) console.error('Failed to add to ingestion queue:', error);
}
