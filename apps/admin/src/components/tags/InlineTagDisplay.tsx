'use client';

import { TaxonomyConfig, TaxonomyData, TagPayload } from './types';
import { COLOR_MAP, getPayloadValue, extractCodes, extractStrings } from './tag-utils';

interface InlineTagDisplayProps {
  payload: TagPayload;
  taxonomyData: TaxonomyData;
  topAudiences: { slug: string; name: string; score: number }[];
  sortedNonAudienceConfigs: TaxonomyConfig[];
}

function AudienceTags({ topAudiences }: { topAudiences: { slug: string; name: string }[] }) {
  const colors = COLOR_MAP.violet;
  return (
    <>
      {topAudiences.map((aud) => (
        <span
          key={aud.slug}
          className={`px-1.5 py-0.5 rounded text-xs ${colors.bg} ${colors.text}`}
        >
          {aud.name}
        </span>
      ))}
    </>
  );
}

function getConfigCodes(config: TaxonomyConfig, payload: TagPayload): string[] {
  let codes =
    config.behavior_type === 'expandable'
      ? extractStrings(getPayloadValue(payload, config.payload_field))
      : extractCodes(getPayloadValue(payload, config.payload_field));
  if (config.slug === 'geography' && codes.length === 0) codes = ['global'];
  return codes.slice(0, 2);
}

function InlineCodeTag({
  config,
  code,
  colors,
  lookupMap,
}: {
  config: TaxonomyConfig;
  code: string;
  colors: { bg: string; text: string };
  lookupMap: Map<string, string> | null;
}) {
  return (
    <span
      key={`${config.slug}-${code}`}
      className={`px-1.5 py-0.5 rounded text-xs ${colors.bg} ${colors.text}`}
    >
      {lookupMap?.get(code) || code}
    </span>
  );
}

function ConfigTags({
  config,
  payload,
  taxonomyData,
}: {
  config: TaxonomyConfig;
  payload: TagPayload;
  taxonomyData: TaxonomyData;
}) {
  const colors = COLOR_MAP[config.color] || COLOR_MAP.neutral;
  const codes = getConfigCodes(config, payload);
  const lookupMap = taxonomyData[config.slug]
    ? new Map(taxonomyData[config.slug].map((i) => [i.code, i.name]))
    : null;
  return (
    <>
      {codes.map((code: string) => (
        <InlineCodeTag
          key={`${config.slug}-${code}`}
          config={config}
          code={code}
          colors={colors}
          lookupMap={lookupMap}
        />
      ))}
    </>
  );
}

export function InlineTagDisplay({
  payload,
  taxonomyData,
  topAudiences,
  sortedNonAudienceConfigs,
}: InlineTagDisplayProps) {
  return (
    <div className="flex flex-wrap gap-1">
      <AudienceTags topAudiences={topAudiences} />
      {sortedNonAudienceConfigs
        .filter((c) => c.behavior_type !== 'scoring')
        .map((config) => (
          <ConfigTags
            key={config.slug}
            config={config}
            payload={payload}
            taxonomyData={taxonomyData}
          />
        ))}
    </div>
  );
}
