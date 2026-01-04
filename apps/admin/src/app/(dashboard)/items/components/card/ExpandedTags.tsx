import { TagBadge } from './TagBadge';
import { extractCodes } from './utils';

interface ExpandedTagsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
}

function renderAudienceTags(scores: Record<string, number> | undefined) {
  if (!scores) return null;
  return Object.entries(scores)
    .filter(([, score]) => score >= 0.5)
    .map(([code]) => <TagBadge key={code} code={code} type="audience" />);
}

function renderCodeTags(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  codes: any[],
  type: 'geography' | 'industry' | 'topic' | 'regulator' | 'regulation' | 'process',
) {
  return extractCodes(codes).map((code: string) => <TagBadge key={code} code={code} type={type} />);
}

export function ExpandedTags({ payload }: Readonly<ExpandedTagsProps>) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {renderAudienceTags(payload.audience_scores)}
      {renderCodeTags(payload.geography_codes, 'geography')}
      {renderCodeTags(payload.industry_codes, 'industry')}
      {renderCodeTags(payload.topic_codes, 'topic')}
      {renderCodeTags(payload.regulator_codes, 'regulator')}
      {renderCodeTags(payload.regulation_codes, 'regulation')}
      {renderCodeTags(payload.process_codes, 'process')}
    </div>
  );
}
