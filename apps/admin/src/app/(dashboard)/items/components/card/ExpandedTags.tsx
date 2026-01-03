import { TagBadge } from './TagBadge';
import { extractCodes } from './utils';

interface ExpandedTagsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
}

export function ExpandedTags({ payload }: ExpandedTagsProps) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {payload.audience_scores &&
        Object.entries(payload.audience_scores as Record<string, number>)
          .filter(([, score]) => score >= 0.5)
          .map(([code]) => <TagBadge key={code} code={code} type="audience" />)}

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {extractCodes(payload.geography_codes as any[]).map((g: string) => (
        <TagBadge key={g} code={g} type="geography" />
      ))}

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {extractCodes(payload.industry_codes as any[]).map((i: string) => (
        <TagBadge key={i} code={i} type="industry" />
      ))}

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {extractCodes(payload.topic_codes as any[]).map((t: string) => (
        <TagBadge key={t} code={t} type="topic" />
      ))}

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {extractCodes(payload.regulator_codes as any[]).map((r: string) => (
        <TagBadge key={r} code={r} type="regulator" />
      ))}

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {extractCodes(payload.regulation_codes as any[]).map((reg: string) => (
        <TagBadge key={reg} code={reg} type="regulation" />
      ))}

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {extractCodes(payload.process_codes as any[]).map((p: string) => (
        <TagBadge key={p} code={p} type="process" />
      ))}
    </div>
  );
}
