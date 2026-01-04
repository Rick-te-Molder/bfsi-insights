import { TagBadge } from './TagBadge';
import { extractCodes } from './utils';

interface CollapsedTagsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
  onToggle: () => void;
}

function extractAudiences(scores: Record<string, number> | null | undefined): string[] {
  return scores
    ? Object.entries(scores)
        .filter(([, s]) => s >= 0.5)
        .map(([c]) => c)
    : [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractAllCodes(payload: any) {
  return {
    audiences: extractAudiences(payload.audience_scores),
    geographies: extractCodes(payload.geography_codes),
    topics: extractCodes(payload.topic_codes),
    industries: extractCodes(payload.industry_codes),
    regulators: extractCodes(payload.regulator_codes),
    regulations: extractCodes(payload.regulation_codes),
    obligations: extractCodes(payload.obligation_codes),
    processes: extractCodes(payload.process_codes),
  };
}

function sumLengths(arrs: string[][]): number {
  return arrs.reduce((sum, a) => sum + a.length, 0);
}

function computeTagCounts(codes: ReturnType<typeof extractAllCodes>) {
  const {
    audiences,
    geographies,
    topics,
    industries,
    regulators,
    regulations,
    obligations,
    processes,
  } = codes;
  const allCodes = [
    audiences,
    geographies,
    topics,
    industries,
    regulators,
    regulations,
    obligations,
    processes,
  ];
  const totalTags = sumLengths(allCodes);
  const extraTagCount =
    Math.max(0, audiences.length - 1) +
    Math.max(0, geographies.length - 1) +
    sumLengths([topics, industries, regulators, regulations, obligations, processes]);
  return { totalTags, extraTagCount };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function useTagData(payload: any) {
  const codes = extractAllCodes(payload);
  const { totalTags, extraTagCount } = computeTagCounts(codes);
  return { audiences: codes.audiences, geographies: codes.geographies, totalTags, extraTagCount };
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

export function CollapsedTags({ payload, onToggle }: Readonly<CollapsedTagsProps>) {
  const { audiences, geographies, totalTags, extraTagCount } = useTagData(payload);
  if (totalTags === 0) return <NoTagsMessage />;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {audiences[0] && <TagBadge code={audiences[0]} type="audience" />}
      {geographies[0] && <TagBadge code={geographies[0]} type="geography" />}
      {extraTagCount > 0 && <MoreButton count={extraTagCount} onToggle={onToggle} />}
    </div>
  );
}
