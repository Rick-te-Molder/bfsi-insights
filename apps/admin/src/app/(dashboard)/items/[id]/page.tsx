import { MarkdownRenderer } from '@/components/ui/markdown-renderer';
import { notFound } from 'next/navigation';
import { ReviewActions } from './actions';
import { EnrichmentPanel } from './enrichment-panel';
import { EvaluationPanel } from './evaluation-panel';
import { UnknownEntitiesPanel } from './unknown-entities';
import { PipelineTimeline } from './pipeline-timeline';
import { TagDisplay } from '@/components/tags';
import type { ValidationLookups } from '@/components/tags';
import { getLookupTables, getProposedEntities, calculateUnknownEntities } from './entity-utils';
import {
  getQueueItem,
  getTaxonomyData,
  getCurrentPrompts,
  getUtilityVersions,
} from './data-loaders';
import {
  PageHeader,
  ThumbnailSection,
  TagsSection,
  OpenSourceButton,
  MetadataPanel,
  RawContentPreview,
} from './page-components';

export default async function ReviewDetailPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string; status?: string }>;
}>) {
  const { id } = await params;
  const { view, status } = await searchParams;
  const backUrl = `/items?${new URLSearchParams({ ...(status && { status }), ...(view && { view }) }).toString()}`;
  const [
    item,
    lookups,
    { taxonomyConfig, taxonomyData },
    currentPrompts,
    utilityVersions,
    proposedEntities,
  ] = await Promise.all([
    getQueueItem(id),
    getLookupTables(),
    getTaxonomyData(),
    getCurrentPrompts(),
    getUtilityVersions(),
    getProposedEntities(id),
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
  const unknownEntities = calculateUnknownEntities(payload, lookups, proposedEntities);

  return (
    <div className="space-y-6">
      <PageHeader
        payload={payload}
        statusCode={item.status_code}
        url={item.url}
        backUrl={backUrl}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Left 2 columns - mimics live site layout */}
        <div className="lg:col-span-2 space-y-4">
          <ThumbnailSection payload={payload} />

          {/* Summary - no header, just content like live site */}
          <div className="text-sm text-neutral-200">
            {summary.long ? (
              <MarkdownRenderer
                content={summary.long}
                className="prose prose-invert prose-sm max-w-none prose-headings:text-neutral-200 prose-headings:font-semibold prose-headings:text-sm prose-p:my-2 prose-ul:my-2 prose-li:my-0.5"
              />
            ) : (
              <p className="text-neutral-500 italic">No summary available</p>
            )}
          </div>

          <TagsSection payload={payload} />

          <OpenSourceButton url={item.url} sourceName={payload.source_name as string | undefined} />

          {/* Separator before admin-only sections */}
          <hr className="border-neutral-800 my-6" />

          {/* Tags & Classification - admin view with validation */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6">
            <h2 className="text-lg font-semibold mb-4">Tags & Classification (Admin View)</h2>
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
          <EnrichmentPanel
            item={item}
            currentPrompts={currentPrompts}
            utilityVersions={utilityVersions}
          />

          {/* Pipeline History */}
          <PipelineTimeline queueId={item.id} currentRunId={item.current_run_id} />

          <MetadataPanel item={item} payload={payload} />

          {typeof payload.raw_content === 'string' && (
            <RawContentPreview rawContent={payload.raw_content} />
          )}
        </div>
      </div>
    </div>
  );
}
