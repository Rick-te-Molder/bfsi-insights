import { TagBadge } from './TagBadge';
import { extractCodes } from './utils';

interface CollapsedTagsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
  onToggle: () => void;
}

export function CollapsedTags({ payload, onToggle }: CollapsedTagsProps) {
  const audienceScores = payload.audience_scores as Record<string, number> | null | undefined;
  const audiences = audienceScores
    ? Object.entries(audienceScores)
        .filter(([, score]) => score >= 0.5)
        .map(([code]) => code)
    : [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geographies = extractCodes(payload.geography_codes as any[]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const topics = extractCodes(payload.topic_codes as any[]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const industries = extractCodes(payload.industry_codes as any[]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const regulators = extractCodes(payload.regulator_codes as any[]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const regulations = extractCodes(payload.regulation_codes as any[]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obligations = extractCodes(payload.obligation_codes as any[]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const processes = extractCodes(payload.process_codes as any[]);

  const totalTags =
    audiences.length +
    geographies.length +
    topics.length +
    industries.length +
    regulators.length +
    regulations.length +
    obligations.length +
    processes.length;

  if (totalTags === 0) {
    return (
      <div className="mt-2 text-xs text-neutral-500 italic">
        No tags available - may need re-enrichment
      </div>
    );
  }

  const extraTagCount =
    Math.max(0, audiences.length - 1) +
    Math.max(0, geographies.length - 1) +
    industries.length +
    topics.length +
    regulators.length +
    regulations.length +
    obligations.length +
    processes.length;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {audiences[0] && <TagBadge code={audiences[0]} type="audience" />}
      {geographies[0] && <TagBadge code={geographies[0]} type="geography" />}
      {extraTagCount > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-700/50 text-neutral-400 ring-1 ring-inset ring-neutral-600/30 hover:bg-neutral-600/50 hover:text-neutral-300 transition-colors pointer-events-auto"
        >
          +{extraTagCount} more
        </button>
      )}
    </div>
  );
}
