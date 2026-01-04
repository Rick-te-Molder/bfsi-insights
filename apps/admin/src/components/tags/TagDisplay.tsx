'use client';

import { TaxonomyConfig, TaxonomyData, TagPayload, ValidationLookups } from './types';
import { getPayloadValue } from './tag-utils';
import { InlineTagDisplay } from './InlineTagDisplay';
import { TableTagDisplay } from './TableTagDisplay';

interface TagDisplayProps {
  payload: TagPayload;
  taxonomyConfig: TaxonomyConfig[];
  taxonomyData: TaxonomyData;
  variant?: 'table' | 'inline' | 'table-with-percentages';
  labelWidth?: string;
  validationLookups?: ValidationLookups;
  showValidation?: boolean;
}

function getAudienceLabel(config: TaxonomyConfig, taxonomyData: TaxonomyData): string {
  const audienceCode = config.payload_field.split('.').pop() || '';
  const lookupData = taxonomyData[config.slug];
  const match = lookupData?.find((item) => item.code === audienceCode);
  return match?.name || config.display_name;
}

function getTopAudiences(
  audienceConfigs: TaxonomyConfig[],
  payload: TagPayload,
  taxonomyData: TaxonomyData,
  maxCount: number = 2,
) {
  return audienceConfigs
    .map((c) => ({
      slug: c.slug,
      name: getAudienceLabel(c, taxonomyData),
      score: (getPayloadValue(payload, c.payload_field) as number) ?? 0,
    }))
    .filter((s) => s.score >= 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxCount);
}

function useTagDisplayData(taxonomyConfig: TaxonomyConfig[]) {
  const audienceConfigs = taxonomyConfig.filter(
    (c) => c.behavior_type === 'scoring' && c.score_parent_slug === 'audience',
  );
  const nonAudienceConfigs = taxonomyConfig.filter(
    (c) => !(c.behavior_type === 'scoring' && c.score_parent_slug === 'audience'),
  );
  const sortedNonAudienceConfigs = [...nonAudienceConfigs].sort(
    (a, b) => a.display_order - b.display_order,
  );
  return { audienceConfigs, sortedNonAudienceConfigs };
}

function InlineView({
  payload,
  taxonomyData,
  audienceConfigs,
  sortedNonAudienceConfigs,
}: {
  payload: TagPayload;
  taxonomyData: TaxonomyData;
  audienceConfigs: TaxonomyConfig[];
  sortedNonAudienceConfigs: TaxonomyConfig[];
}) {
  return (
    <InlineTagDisplay
      payload={payload}
      taxonomyData={taxonomyData}
      topAudiences={getTopAudiences(audienceConfigs, payload, taxonomyData, 1)}
      sortedNonAudienceConfigs={sortedNonAudienceConfigs}
    />
  );
}

interface TableViewProps {
  payload: TagPayload;
  taxonomyData: TaxonomyData;
  labelWidth: string;
  validationLookups?: ValidationLookups;
  showValidation: boolean;
  audienceConfigs: TaxonomyConfig[];
  sortedNonAudienceConfigs: TaxonomyConfig[];
  variant: string;
}

function TableView({
  payload,
  taxonomyData,
  labelWidth,
  validationLookups,
  showValidation,
  audienceConfigs,
  sortedNonAudienceConfigs,
  variant,
}: TableViewProps) {
  return (
    <TableTagDisplay
      payload={payload}
      taxonomyData={taxonomyData}
      labelWidth={labelWidth}
      validationLookups={validationLookups}
      showValidation={showValidation}
      audienceConfigs={audienceConfigs}
      sortedNonAudienceConfigs={sortedNonAudienceConfigs}
      showPercentages={variant === 'table-with-percentages'}
      getAudienceLabel={(c: TaxonomyConfig) => getAudienceLabel(c, taxonomyData)}
      getTopAudiences={(n?: number) => getTopAudiences(audienceConfigs, payload, taxonomyData, n)}
    />
  );
}

export function TagDisplay({
  payload,
  taxonomyConfig,
  taxonomyData,
  variant = 'table',
  labelWidth = 'w-24',
  validationLookups,
  showValidation = false,
}: TagDisplayProps) {
  const { audienceConfigs, sortedNonAudienceConfigs } = useTagDisplayData(taxonomyConfig);
  const viewProps = { payload, taxonomyData, audienceConfigs, sortedNonAudienceConfigs };

  if (variant === 'inline') return <InlineView {...viewProps} />;

  return (
    <TableView
      {...viewProps}
      labelWidth={labelWidth}
      validationLookups={validationLookups}
      showValidation={showValidation}
      variant={variant}
    />
  );
}
