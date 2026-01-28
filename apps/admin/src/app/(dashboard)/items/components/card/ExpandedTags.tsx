import { TagBadge } from './TagBadge';
import type { TaxonomyConfig } from '@/components/tags';
import {
  getPayloadValue,
  extractCodes as extractCodesFromPayload,
} from '@/components/tags/tag-utils';

interface ExpandedTagsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
  taxonomyConfig: TaxonomyConfig[];
}

function renderAudienceTags(payload: any, configs: TaxonomyConfig[]) {
  return configs
    .map((config) => {
      const score = getPayloadValue(payload, config.payload_field) as number;
      if (score && score >= 0.5) {
        const code = config.payload_field.split('.').pop();
        if (code) return <TagBadge key={code} code={code} type="audience" />;
      }
      return null;
    })
    .filter(Boolean);
}

function renderTaxonomyTags(payload: any, configs: TaxonomyConfig[]) {
  return configs.flatMap((config) => {
    const value = getPayloadValue(payload, config.payload_field);
    const codes = extractCodesFromPayload(value);
    return codes.map((code) => (
      <TagBadge key={`${config.slug}-${code}`} code={code} type={config.slug as any} />
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
