import Link from 'next/link';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { formatDateTime, getStatusColor } from '@/lib/utils';
import { notFound } from 'next/navigation';
import { ReviewActions } from './actions';
import { EvaluationPanel } from './evaluation-panel';
import { UnknownEntitiesPanel } from './unknown-entities';

interface QueueItem {
  id: string;
  url: string;
  status: string;
  payload: Record<string, unknown>;
  discovered_at: string;
}

interface LookupTables {
  regulators: Set<string>;
  standardSetters: Set<string>;
  organizations: Set<string>;
  vendors: Set<string>;
}

async function getQueueItem(id: string) {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase.from('ingestion_queue').select('*').eq('id', id).single();

  if (error || !data) {
    return null;
  }

  return data as QueueItem;
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

// Helper to check if a value exists in lookup and render with validation styling
function ValidatedTag({
  value,
  knownValues,
  baseColor,
  unknownColor = 'bg-red-500/30 text-red-300 border border-red-500/50',
}: {
  value: string;
  knownValues?: Set<string>;
  baseColor: string;
  unknownColor?: string;
}) {
  const isKnown = !knownValues || knownValues.has(value.toLowerCase());
  return (
    <span
      className={`px-2 py-0.5 rounded text-xs ${isKnown ? baseColor : unknownColor}`}
      title={isKnown ? undefined : '⚠️ Not in reference table'}
    >
      {value}
      {!isKnown && ' ⚠️'}
    </span>
  );
}

export default async function ReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [item, lookups] = await Promise.all([getQueueItem(id), getLookupTables()]);

  if (!item) {
    notFound();
  }

  const payload = item.payload || {};
  const summary = (payload.summary as { short?: string; medium?: string; long?: string }) || {};

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
            <Link href="/review" className="text-neutral-400 hover:text-white text-sm">
              ← Back to queue
            </Link>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(item.status)}`}
            >
              {item.status}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white">
            {(payload.title as string) || 'Untitled'}
          </h1>
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
                    Short (120-150 chars)
                  </span>
                  <span
                    className={`text-xs ${
                      summary.short && summary.short.length >= 120 && summary.short.length <= 150
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
                    Medium (250-300 chars)
                  </span>
                  <span
                    className={`text-xs ${
                      summary.medium && summary.medium.length >= 250 && summary.medium.length <= 300
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
                  <span className="text-sm font-medium text-neutral-400">Long (500-600 chars)</span>
                  <span
                    className={`text-xs ${
                      summary.long && summary.long.length >= 500 && summary.long.length <= 600
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {summary.long?.length || 0} chars
                  </span>
                </div>
                <p className="text-neutral-200 bg-neutral-800/50 rounded-lg p-3">
                  {summary.long || 'No long summary'}
                </p>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6">
            <h2 className="text-lg font-semibold mb-4">Tags & Classification</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-neutral-500">Industries</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {((payload.industry_codes as string[]) || []).map((code) => (
                    <span
                      key={code}
                      className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-xs"
                    >
                      {code}
                    </span>
                  ))}
                  {!(payload.industry_codes as string[])?.length && (
                    <span className="text-neutral-600 text-xs">None</span>
                  )}
                </div>
              </div>

              <div>
                <span className="text-xs text-neutral-500">Topics</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {((payload.topic_codes as string[]) || []).map((code) => (
                    <span
                      key={code}
                      className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-xs"
                    >
                      {code}
                    </span>
                  ))}
                  {!(payload.topic_codes as string[])?.length && (
                    <span className="text-neutral-600 text-xs">None</span>
                  )}
                </div>
              </div>

              <div>
                <span className="text-xs text-neutral-500">Vendors</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {((payload.vendor_names as string[]) || []).map((name) => (
                    <ValidatedTag
                      key={name}
                      value={name}
                      knownValues={lookups.vendors}
                      baseColor="bg-teal-500/20 text-teal-300"
                    />
                  ))}
                  {!(payload.vendor_names as string[])?.length && (
                    <span className="text-neutral-600 text-xs">None</span>
                  )}
                </div>
              </div>

              <div>
                <span className="text-xs text-neutral-500">Organizations</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {((payload.organization_names as string[]) || []).map((name) => (
                    <ValidatedTag
                      key={name}
                      value={name}
                      knownValues={lookups.organizations}
                      baseColor="bg-pink-500/20 text-pink-300"
                    />
                  ))}
                  {!(payload.organization_names as string[])?.length && (
                    <span className="text-neutral-600 text-xs">None</span>
                  )}
                </div>
              </div>

              <div>
                <span className="text-xs text-neutral-500">Regulators</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {((payload.regulator_codes as string[]) || []).map((code) => (
                    <ValidatedTag
                      key={code}
                      value={code}
                      knownValues={lookups.regulators}
                      baseColor="bg-amber-500/20 text-amber-300"
                    />
                  ))}
                  {!(payload.regulator_codes as string[])?.length && (
                    <span className="text-neutral-600 text-xs">None</span>
                  )}
                </div>
              </div>

              <div>
                <span className="text-xs text-neutral-500">Geographies</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {((payload.geography_codes as string[]) || []).map((code) => (
                    <span
                      key={code}
                      className="px-2 py-0.5 rounded bg-green-500/20 text-green-300 text-xs"
                    >
                      {code}
                    </span>
                  ))}
                  {!(payload.geography_codes as string[])?.length && (
                    <span className="text-neutral-600 text-xs">None</span>
                  )}
                </div>
              </div>

              <div>
                <span className="text-xs text-neutral-500">Standard Setters</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {((payload.standard_setter_codes as string[]) || []).map((code) => (
                    <ValidatedTag
                      key={code}
                      value={code}
                      knownValues={lookups.standardSetters}
                      baseColor="bg-orange-500/20 text-orange-300"
                    />
                  ))}
                  {!(payload.standard_setter_codes as string[])?.length && (
                    <span className="text-neutral-600 text-xs">None</span>
                  )}
                </div>
              </div>
            </div>
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
