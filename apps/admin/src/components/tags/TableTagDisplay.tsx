'use client';

import {
  TaxonomyConfig,
  TaxonomyData,
  TagPayload,
  ValidationLookups,
  TagColors,
  AudienceInfo,
  GetAudienceLabelFn,
  GetTopAudiencesFn,
} from './types';
import { COLOR_MAP, getPayloadValue, extractCodes } from './tag-utils';
import { TagCategoryRow } from './TagCategoryRow';

interface TableTagDisplayProps {
  payload: TagPayload;
  taxonomyData: TaxonomyData;
  labelWidth: string;
  validationLookups?: ValidationLookups;
  showValidation: boolean;
  audienceConfigs: TaxonomyConfig[];
  sortedNonAudienceConfigs: TaxonomyConfig[];
  showPercentages: boolean;
  getAudienceLabel: GetAudienceLabelFn;
  getTopAudiences: GetTopAudiencesFn;
}

function hasAnyAudienceScore(configs: TaxonomyConfig[], payload: TagPayload): boolean {
  return configs.some((c) => {
    const score = getPayloadValue(payload, c.payload_field) as number | undefined;
    return score !== undefined && score >= (c.score_threshold ?? 0.5);
  });
}

interface AudienceScoreTagProps {
  config: TaxonomyConfig;
  payload: TagPayload;
  getAudienceLabel: GetAudienceLabelFn;
}

function AudienceScoreTag({ config, payload, getAudienceLabel }: Readonly<AudienceScoreTagProps>) {
  const score = getPayloadValue(payload, config.payload_field) as number | undefined;
  if (score === undefined || score < (config.score_threshold ?? 0.5)) return null;
  const colors = COLOR_MAP.violet;
  return (
    <span key={config.slug} className={`px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}>
      {getAudienceLabel(config)} ({(score * 100).toFixed(0)}%)
    </span>
  );
}

interface AudienceWithPercentagesProps {
  audienceConfigs: TaxonomyConfig[];
  payload: TagPayload;
  getAudienceLabel: GetAudienceLabelFn;
}

function AudienceWithPercentages({
  audienceConfigs,
  payload,
  getAudienceLabel,
}: Readonly<AudienceWithPercentagesProps>) {
  if (!hasAnyAudienceScore(audienceConfigs, payload))
    return <span className="text-neutral-600 italic">—</span>;
  return (
    <>
      {audienceConfigs.map((c) => (
        <AudienceScoreTag
          key={c.slug}
          config={c}
          payload={payload}
          getAudienceLabel={getAudienceLabel}
        />
      ))}
    </>
  );
}

function AudienceSimple({ topAudiences }: Readonly<{ topAudiences: AudienceInfo[] }>) {
  const colors = COLOR_MAP.violet;
  if (topAudiences.length === 0) return <span className="text-neutral-600 italic">—</span>;
  return (
    <>
      {topAudiences.map((aud) => (
        <span key={aud.slug} className={`px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}>
          {aud.name}
        </span>
      ))}
    </>
  );
}

interface AudienceContentProps {
  showPercentages: boolean;
  audienceConfigs: TaxonomyConfig[];
  payload: TagPayload;
  getAudienceLabel: GetAudienceLabelFn;
  getTopAudiences: GetTopAudiencesFn;
}

function AudienceContent({
  showPercentages,
  audienceConfigs,
  payload,
  getAudienceLabel,
  getTopAudiences,
}: Readonly<AudienceContentProps>) {
  if (showPercentages)
    return (
      <AudienceWithPercentages
        audienceConfigs={audienceConfigs}
        payload={payload}
        getAudienceLabel={getAudienceLabel}
      />
    );
  return <AudienceSimple topAudiences={getTopAudiences(1)} />;
}

interface AudienceRowProps {
  labelWidth: string;
  audienceConfigs: TaxonomyConfig[];
  payload: TagPayload;
  showPercentages: boolean;
  getAudienceLabel: GetAudienceLabelFn;
  getTopAudiences: GetTopAudiencesFn;
}

function AudienceRow({
  labelWidth,
  audienceConfigs,
  payload,
  showPercentages,
  getAudienceLabel,
  getTopAudiences,
}: Readonly<AudienceRowProps>) {
  if (audienceConfigs.length === 0) return null;
  return (
    <div className="flex items-start justify-between gap-2">
      <span className={`text-neutral-500 shrink-0 ${labelWidth}`}>Audience</span>
      <div className="flex flex-wrap gap-1 justify-end">
        <AudienceContent
          showPercentages={showPercentages}
          audienceConfigs={audienceConfigs}
          payload={payload}
          getAudienceLabel={getAudienceLabel}
          getTopAudiences={getTopAudiences}
        />
      </div>
    </div>
  );
}

interface GeographyCodeTagProps {
  code: string;
  colors: TagColors;
  lookupMap: Map<string, string> | null;
}

function GeographyCodeTag({ code, colors, lookupMap }: Readonly<GeographyCodeTagProps>) {
  return (
    <span key={code} className={`px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}>
      {lookupMap?.get(code) || code}
    </span>
  );
}

interface GeographyRowProps {
  config: TaxonomyConfig;
  payload: TagPayload;
  taxonomyData: TaxonomyData;
  labelWidth: string;
}

function GeographyRow({ config, payload, taxonomyData, labelWidth }: Readonly<GeographyRowProps>) {
  const codes = extractCodes(getPayloadValue(payload, config.payload_field));
  const colors = COLOR_MAP[config.color] || COLOR_MAP.neutral;
  const lookupMap = taxonomyData[config.slug]
    ? new Map(taxonomyData[config.slug].map((i) => [i.code, i.name]))
    : null;
  const displayCodes = codes.length > 0 ? codes : ['global'];
  return (
    <div className="flex items-start justify-between gap-2">
      <span className={`text-neutral-500 shrink-0 ${labelWidth}`}>{config.display_name}</span>
      <div className="flex flex-wrap gap-1 justify-end">
        {displayCodes.map((code: string) => (
          <GeographyCodeTag key={code} code={code} colors={colors} lookupMap={lookupMap} />
        ))}
      </div>
    </div>
  );
}

interface ConfigRowProps {
  config: TaxonomyConfig;
  payload: TagPayload;
  taxonomyData: TaxonomyData;
  labelWidth: string;
  validationLookups?: ValidationLookups;
  showValidation: boolean;
}

function ConfigRow({
  config,
  payload,
  taxonomyData,
  labelWidth,
  validationLookups,
  showValidation,
}: Readonly<ConfigRowProps>) {
  if (config.slug === 'geography')
    return (
      <GeographyRow
        config={config}
        payload={payload}
        taxonomyData={taxonomyData}
        labelWidth={labelWidth}
      />
    );
  return (
    <TagCategoryRow
      config={config}
      payload={payload}
      taxonomyData={taxonomyData}
      labelWidth={labelWidth}
      validationLookups={validationLookups}
      showValidation={showValidation}
    />
  );
}

interface ConfigRowListProps {
  configs: TaxonomyConfig[];
  payload: TagPayload;
  taxonomyData: TaxonomyData;
  labelWidth: string;
  validationLookups?: ValidationLookups;
  showValidation: boolean;
}

function ConfigRowList({ configs, ...rowProps }: Readonly<ConfigRowListProps>) {
  return (
    <>
      {configs.map((config) => (
        <ConfigRow key={config.slug} config={config} {...rowProps} />
      ))}
    </>
  );
}

export function TableTagDisplay(props: Readonly<TableTagDisplayProps>) {
  const {
    audienceConfigs,
    sortedNonAudienceConfigs,
    showPercentages,
    getAudienceLabel,
    getTopAudiences,
    ...commonProps
  } = props;
  const audienceRowProps = {
    ...commonProps,
    audienceConfigs,
    showPercentages,
    getAudienceLabel,
    getTopAudiences,
  };

  return (
    <div className="space-y-2 text-xs">
      <AudienceRow {...audienceRowProps} />
      <ConfigRowList configs={sortedNonAudienceConfigs} {...commonProps} />
    </div>
  );
}
