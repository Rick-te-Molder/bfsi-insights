import { createServiceRoleClient } from '@/lib/supabase/server';
import type { TaxonomyConfig, TaxonomyData, TaxonomyItem } from '@/components/tags';
import type { QueueItem } from '@bfsi/types';

interface QueueItemWithRun extends QueueItem {
  current_run_id?: string | null;
}

export async function getQueueItem(id: string): Promise<QueueItemWithRun | null> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase.from('ingestion_queue').select('*').eq('id', id).single();

  if (!error && data) {
    return data as QueueItemWithRun;
  }

  const { data: pubData, error: pubError } = await supabase
    .from('kb_publication')
    .select(
      'id, source_url, title, summary_short, summary_medium, summary_long, source_name, date_published, date_added, thumbnail',
    )
    .eq('id', id)
    .single();

  if (pubError || !pubData) {
    return null;
  }

  return {
    id: pubData.id,
    url: pubData.source_url,
    status_code: 400,
    discovered_at: pubData.date_added || '',
    payload: {
      title: pubData.title,
      source_name: pubData.source_name,
      date_published: pubData.date_published,
      thumbnail_url: pubData.thumbnail,
      summary: {
        short: pubData.summary_short,
        medium: pubData.summary_medium,
        long: pubData.summary_long,
      },
    },
  } as QueueItemWithRun;
}

export async function getTaxonomyData() {
  const supabase = createServiceRoleClient();

  const { data: configData } = await supabase
    .from('taxonomy_config')
    .select(
      'slug, display_name, display_order, behavior_type, source_table, payload_field, color, score_parent_slug, score_threshold',
    )
    .eq('is_active', true)
    .order('display_order');

  const taxonomyConfig = (configData || []) as TaxonomyConfig[];

  const taxonomyData: TaxonomyData = {};
  const sourceTables = taxonomyConfig
    .filter((c) => c.source_table && c.behavior_type !== 'scoring')
    .map((c) => ({ slug: c.slug, table: c.source_table! }));

  const tableResults = await Promise.all(
    sourceTables.map((t) => supabase.from(t.table).select('code, name').order('name')),
  );

  for (let i = 0; i < sourceTables.length; i++) {
    const slug = sourceTables[i].slug;
    const data = tableResults[i].data || [];
    taxonomyData[slug] = data as TaxonomyItem[];
  }

  return { taxonomyConfig, taxonomyData };
}

export async function getCurrentPrompts() {
  const supabase = createServiceRoleClient();

  const { data } = await supabase
    .from('prompt_version')
    .select('id, version, agent_name')
    .eq('stage', 'PRD')
    .in('agent_name', ['summarizer', 'tagger', 'thumbnail-generator']);

  return (data || []) as { id: string; version: string; agent_name: string }[];
}

export async function getUtilityVersions() {
  // Directly return utility versions (keep in sync with agent-api/src/lib/utility-versions.js)
  const UTILITY_VERSIONS = {
    'thumbnail-generator': '1.0.0',
  };

  return Object.entries(UTILITY_VERSIONS).map(([agent_name, version]) => ({
    agent_name,
    version,
  }));
}
