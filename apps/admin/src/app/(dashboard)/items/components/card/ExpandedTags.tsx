import { TagBadge } from './TagBadge';
import type { TagType } from './TagBadge';
import type { TagPayload, TaxonomyConfig } from '@/components/tags';
import {
  getPayloadValue,
  extractCodes as extractCodesFromPayload,
} from '@/components/tags/tag-utils';

interface ExpandedTagsProps {
  payload: TagPayload;
  taxonomyConfig: TaxonomyConfig[];
}

function renderAudienceTags(payload: TagPayload, configs: TaxonomyConfig[]) {
  const topAudiences = configs
    .map((config) => {
      const score = getPayloadValue(payload, config.payload_field);
      const code = config.payload_field.split('.').pop();
      return typeof score === 'number' && score >= 0.5 && code ? { code, score } : null;
    })
    .filter((v): v is { code: string; score: number } => v !== null)
    .sort((a, b) => b.score - a.score);

  return topAudiences.map(({ code }) => <TagBadge key={code} code={code} type="audience" />);
}

function renderTaxonomyTags(payload: TagPayload, configs: TaxonomyConfig[]) {
  return configs.flatMap((config) => {
    const value = getPayloadValue(payload, config.payload_field);
    const codes = extractCodesFromPayload(value);
    return codes.map((code) => (
      <TagBadge key={`${config.slug}-${code}`} code={code} type={config.slug as TagType} />
    ));
  });
}

export function ExpandedTags({ payload, taxonomyConfig }: Readonly<ExpandedTagsProps>) {
  const audienceConfigs = taxonomyConfig.filter(
    (c) => c.behavior_type === 'scoring' && c.score_parent_slug === 'audience',
  );
  const nonAudienceConfigs = taxonomyConfig.filter(
    (c) => !(c.behavior_type === 'scoring' && c.score_parent_slug === 'audience'),
  );
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {renderAudienceTags(payload, audienceConfigs)}
      {renderTaxonomyTags(payload, nonAudienceConfigs)}
    </div>
  );
}
