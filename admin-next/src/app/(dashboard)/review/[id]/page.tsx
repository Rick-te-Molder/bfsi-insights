import Link from 'next/link';
import Markdown from 'react-markdown';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { formatDateTime, getStatusColorByCode, getStatusName } from '@/lib/utils';
import { notFound } from 'next/navigation';
import { ReviewActions } from './actions';
import { EnrichmentPanel } from './enrichment-panel';
import { EvaluationPanel } from './evaluation-panel';
import { UnknownEntitiesPanel } from './unknown-entities';
import { PipelineTimeline } from './pipeline-timeline';
import { TagDisplay } from '@/components/tags';
import type {
  TaxonomyConfig,
  TaxonomyData,
  TaxonomyItem,
  ValidationLookups,
} from '@/components/tags';
import type { QueueItem } from '@bfsi/types';

// Extended QueueItem with current_run_id for this page
interface QueueItemWithRun extends QueueItem {
  current_run_id?: string | null;
}

interface LookupTables {
  regulators: Set<string>;
  standardSetters: Set<string>;
  organizations: Set<string>;
  vendors: Set<string>;
}

async function getQueueItem(id: string) {
  const supabase = createServiceRoleClient();

  // Try ingestion_queue first
  const { data, error } = await supabase.from('ingestion_queue').select('*').eq('id', id).single();

  if (!error && data) {
    return data as QueueItemWithRun;
  }

  // If not found, try kb_publication (for published items)
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

  // Transform kb_publication to QueueItem format
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

async function getLookupTables(): Promise<LookupTables> {
  const supabase = createServiceRoleClient();

  const [regulatorsRes, standardSettersRes, orgsRes, vendorsRes] = await Promise.all([
    supabase.from('regulator').select('slug'),
    supabase.from('standard_setter').select('slug'),
    supabase.from('bfsi_organization').select('slug'),
    supabase.from('ag_vendor').select('slug'),
  ]);

  return {
    regulators: new Set((regulatorsRes.data || []).map((r) => r.slug)),
    standardSetters: new Set((standardSettersRes.data || []).map((s) => s.slug)),
    organizations: new Set((orgsRes.data || []).map((o) => o.slug)),
    vendors: new Set((vendorsRes.data || []).map((v) => v.slug)),
  };
}

async function getTaxonomyData() {
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
    sourceTables.map(({ slug, table }) =>
      supabase
        .from(table)
        .select('code, name')
        .order('name')
        .then((res) => ({ slug, data: res.data || [] })),
    ),
  );

  for (const { slug, data } of tableResults) {
    taxonomyData[slug] = data as TaxonomyItem[];
  }

  return { taxonomyConfig, taxonomyData };
}

async function getCurrentPrompts() {
  const supabase = createServiceRoleClient();

  const { data } = await supabase
    .from('prompt_version')
    .select('id, version, agent_name')
    .eq('is_current', true)
    .in('agent_name', ['summarizer', 'tagger', 'thumbnail-generator']);

  return (data || []) as { id: string; version: string; agent_name: string }[];
}

export default async function ReviewDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string; status?: string }>;
}) {
  const { id } = await params;
  const { view, status } = await searchParams;
  const backUrl = `/review?${new URLSearchParams({ ...(status && { status }), ...(view && { view }) }).toString()}`;
  const [item, lookups, { taxonomyConfig, taxonomyData }, currentPrompts] = await Promise.all([
    getQueueItem(id),
    getLookupTables(),
    getTaxonomyData(),
    getCurrentPrompts(),
  ]);

  if (!item) {
    notFound();
  }

  const payload = item.payload || {};
  const summary = (payload.summary as { short?: string; medium?: string; long?: string }) || {};

  // Convert lookups to ValidationLookups format for TagDisplay
  const validationLookups: ValidationLookups = {
    vendor: lookups.vendors,
    organization: lookups.organizations,
    regulator: lookups.regulators,
  };

  // Calculate unknown entities
  const unknownEntities: {
    entityType: 'regulator' | 'standard_setter' | 'bfsi_organization' | 'ag_vendor';
    name: string;
    label: string;
  }[] = [];

  for (const name of (payload.organization_names as string[]) || []) {
    if (!lookups.organizations.has(name.toLowerCase())) {
      unknownEntities.push({ entityType: 'bfsi_organization', name, label: 'Organization' });
    }
  }
  for (const name of (payload.vendor_names as string[]) || []) {
    if (!lookups.vendors.has(name.toLowerCase())) {
      unknownEntities.push({ entityType: 'ag_vendor', name, label: 'Vendor' });
    }
  }
  for (const code of (payload.regulator_codes as string[]) || []) {
    if (!lookups.regulators.has(code.toLowerCase())) {
      unknownEntities.push({ entityType: 'regulator', name: code, label: 'Regulator' });
    }
  }
  for (const code of (payload.standard_setter_codes as string[]) || []) {
    if (!lookups.standardSetters.has(code.toLowerCase())) {
      unknownEntities.push({ entityType: 'standard_setter', name: code, label: 'Standard Setter' });
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Link href={backUrl} className="text-neutral-400 hover:text-white text-sm">
              ← Back to queue
            </Link>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColorByCode(item.status_code)}`}
            >
              {getStatusName(item.status_code)}
            </span>
          </div>
          {/* Title */}
          <h1 className="text-2xl font-bold text-white">
            {(payload.title as string) || 'Untitled'}
          </h1>
          {/* Date */}
          {typeof payload.published_at === 'string' && (
            <p className="text-sm text-neutral-400 mt-1">
              Published{' '}
              {new Date(payload.published_at).toLocaleDateString('en-GB', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </p>
          )}
          {/* URL */}
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 text-sm text-sky-400 hover:text-sky-300 truncate block"
          >
            {item.url} ↗
          </a>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Left 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Summaries */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6">
            <h2 className="text-lg font-semibold mb-4">AI Summaries</h2>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-neutral-400">
                    Short (100-150 chars)
                  </span>
                  <span
                    className={`text-xs ${
                      summary.short && summary.short.length >= 100 && summary.short.length <= 150
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {summary.short?.length || 0} chars
                  </span>
                </div>
                <p className="text-neutral-200 bg-neutral-800/50 rounded-lg p-3">
                  {summary.short || 'No short summary'}
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-neutral-400">
                    Medium (200-300 chars)
                  </span>
                  <span
                    className={`text-xs ${
                      summary.medium && summary.medium.length >= 200 && summary.medium.length <= 300
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {summary.medium?.length || 0} chars
                  </span>
                </div>
                <p className="text-neutral-200 bg-neutral-800/50 rounded-lg p-3">
                  {summary.medium || 'No medium summary'}
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-neutral-400">Long (400-600 chars)</span>
                  <span
                    className={`text-xs ${
                      summary.long && summary.long.length >= 400 && summary.long.length <= 600
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {summary.long?.length || 0} chars
                  </span>
                </div>
                <div className="text-neutral-200 bg-neutral-800/50 rounded-lg p-3 prose prose-invert prose-sm max-w-none prose-headings:text-neutral-200 prose-headings:font-semibold prose-headings:text-sm prose-p:my-1 prose-ul:my-1 prose-li:my-0">
                  {summary.long ? <Markdown>{summary.long}</Markdown> : <p>No long summary</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Tags - Dynamic from taxonomy_config with validation */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6">
            <h2 className="text-lg font-semibold mb-4">Tags & Classification</h2>
            <TagDisplay
              payload={payload}
              taxonomyConfig={taxonomyConfig}
              taxonomyData={taxonomyData}
              variant="table-with-percentages"
              labelWidth="w-28"
              validationLookups={validationLookups}
              showValidation={true}
            />
          </div>

          {/* Unknown Entities */}
          <UnknownEntitiesPanel
            unknownEntities={unknownEntities}
            sourceQueueId={item.id}
            sourceUrl={item.url}
          />

          {/* Evaluation Panel */}
          <EvaluationPanel item={item} />
        </div>

        {/* Sidebar - Right column */}
        <div className="space-y-6">
          {/* Actions */}
          <ReviewActions item={item} />

          {/* Enrichment Panel with version tracking */}
          <EnrichmentPanel item={item} currentPrompts={currentPrompts} />

          {/* Pipeline History */}
          <PipelineTimeline queueId={item.id} currentRunId={item.current_run_id} />

          {/* Metadata */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
            <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-3">
              Metadata
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-neutral-500">Discovered</dt>
                <dd className="text-neutral-300">{formatDateTime(item.discovered_at)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">Published</dt>
                <dd className={payload.published_at ? 'text-neutral-300' : 'text-amber-400'}>
                  {payload.published_at
                    ? formatDateTime(payload.published_at as string)
                    : 'Not extracted'}
                </dd>
              </div>
              {!!payload.source_slug && (
                <div className="flex justify-between">
                  <dt className="text-neutral-500">Source</dt>
                  <dd className="text-neutral-300">{String(payload.source_slug)}</dd>
                </div>
              )}
              {typeof payload.relevance_confidence === 'number' && (
                <div className="flex justify-between">
                  <dt className="text-neutral-500">AI Confidence</dt>
                  <dd className="text-emerald-400">
                    {Math.round(payload.relevance_confidence * 100)}%
                  </dd>
                </div>
              )}
              {typeof payload.content_length === 'number' && (
                <div className="flex justify-between">
                  <dt className="text-neutral-500">Content Length</dt>
                  <dd className="text-neutral-300">
                    {payload.content_length.toLocaleString()} chars
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Raw Content Preview */}
          {typeof payload.raw_content === 'string' && (
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
              <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-3">
                Original Content Preview
              </h3>
              <div className="text-xs text-neutral-400 bg-neutral-800/50 rounded-lg p-3 max-h-64 overflow-y-auto">
                <pre className="whitespace-pre-wrap font-mono">
                  {payload.raw_content.slice(0, 2000)}
                  {payload.raw_content.length > 2000 && '...'}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
