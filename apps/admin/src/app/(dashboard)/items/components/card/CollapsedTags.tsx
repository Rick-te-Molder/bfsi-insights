import { TagBadge } from './TagBadge';
import type { TaxonomyConfig } from '@/components/tags';
import {
  getPayloadValue,
  extractCodes as extractCodesFromPayload,
} from '@/components/tags/tag-utils';

interface CollapsedTagsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
  onToggle: () => void;
  taxonomyConfig: TaxonomyConfig[];
}

function extractAudienceCodes(payload: any, configs: TaxonomyConfig[]): string[] {
  const audiences: string[] = [];
  for (const config of configs) {
    const score = getPayloadValue(payload, config.payload_field) as number;
    if (score && score >= 0.5) {
      const code = config.payload_field.split('.').pop();
      if (code) audiences.push(code);
    }
  }
  return audiences;
}

function extractNonAudienceCodes(payload: any, configs: TaxonomyConfig[]) {
  const codesBySlug: Record<string, string[]> = {};
  for (const config of configs) {
    const value = getPayloadValue(payload, config.payload_field);
    const codes = extractCodesFromPayload(value);
    if (codes.length > 0) codesBySlug[config.slug] = codes;
  }
  return codesBySlug;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractAllCodes(payload: any, taxonomyConfig: TaxonomyConfig[]) {
  const audienceConfigs = taxonomyConfig.filter(
    (c) => c.behavior_type === 'scoring' && c.score_parent_slug === 'audience',
  );
  const nonAudienceConfigs = taxonomyConfig.filter(
    (c) => !(c.behavior_type === 'scoring' && c.score_parent_slug === 'audience'),
  );
  return {
    audiences: extractAudienceCodes(payload, audienceConfigs),
    codesBySlug: extractNonAudienceCodes(payload, nonAudienceConfigs),
    nonAudienceConfigs,
  };
}

function sumLengths(arrs: string[][]): number {
  return arrs.reduce((sum, a) => sum + a.length, 0);
}

function computeTagCounts(codes: ReturnType<typeof extractAllCodes>) {
  const { audiences, codesBySlug } = codes;
  const allCodeArrays = Object.values(codesBySlug);
  const totalTags = audiences.length + sumLengths(allCodeArrays);

  // Count extra tags (beyond first audience and first other tag)
  const firstOtherSlug = Object.keys(codesBySlug)[0];
  const firstOtherCount = firstOtherSlug ? codesBySlug[firstOtherSlug].length : 0;

  const extraTagCount =
    Math.max(0, audiences.length - 1) +
    Math.max(0, firstOtherCount - 1) +
    sumLengths(
      Object.entries(codesBySlug)
        .slice(1)
        .map(([, codes]) => codes),
    );

  return { totalTags, extraTagCount };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function useTagData(payload: any, taxonomyConfig: TaxonomyConfig[]) {
  const codes = extractAllCodes(payload, taxonomyConfig);
  const { totalTags, extraTagCount } = computeTagCounts(codes);
  const firstOtherSlug = Object.keys(codes.codesBySlug)[0];
  const firstOtherCode = firstOtherSlug ? codes.codesBySlug[firstOtherSlug][0] : null;
  const firstOtherConfig = firstOtherSlug
    ? codes.nonAudienceConfigs.find((c) => c.slug === firstOtherSlug)
    : null;

  return {
    audiences: codes.audiences,
    firstOtherCode,
    firstOtherType: firstOtherConfig?.slug as any,
    totalTags,
    extraTagCount,
  };
}

function MoreButton({ count, onToggle }: Readonly<{ count: number; onToggle: () => void }>) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-700/50 text-neutral-400 ring-1 ring-inset ring-neutral-600/30 hover:bg-neutral-600/50 hover:text-neutral-300 transition-colors pointer-events-auto"
    >
      +{count} more
    </button>
  );
}

function NoTagsMessage() {
  return (
    <div className="mt-2 text-xs text-neutral-500 italic">
      No tags available - may need re-enrichment
    </div>
  );
}

export function CollapsedTags({ payload, onToggle, taxonomyConfig }: Readonly<CollapsedTagsProps>) {
  const { audiences, firstOtherCode, firstOtherType, totalTags, extraTagCount } = useTagData(
    payload,
    taxonomyConfig,
  );
  if (totalTags === 0) return <NoTagsMessage />;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {audiences[0] && <TagBadge code={audiences[0]} type="audience" />}
      {firstOtherCode && firstOtherType && <TagBadge code={firstOtherCode} type={firstOtherType} />}
      {extraTagCount > 0 && <MoreButton count={extraTagCount} onToggle={onToggle} />}
    </div>
  );
}
