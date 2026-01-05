'use client';

import {
  TaxonomyConfig,
  TaxonomyData,
  TagPayload,
  ValidationLookups,
  TagColors,
  ConfigRowProps,
  ConfigRowWithValidationProps,
  ConfigRowWithDataProps,
} from './types';
import { COLOR_MAP, getPayloadValue, extractCodes, extractStrings } from './tag-utils';

interface TagCategoryRowProps {
  config: TaxonomyConfig;
  payload: TagPayload;
  taxonomyData: TaxonomyData;
  labelWidth?: string;
  validationLookups?: ValidationLookups;
  showValidation?: boolean;
}

function ScoreTag({ score, colors }: Readonly<{ score: number; colors: TagColors }>) {
  return (
    <span className={`px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}>
      {(score * 100).toFixed(0)}%
    </span>
  );
}

function ScoringRow({ config, payload, labelWidth, colors }: Readonly<ConfigRowProps>) {
  const score = getPayloadValue(payload, config.payload_field) as number | undefined;
  const showScore = score !== undefined && score >= (config.score_threshold ?? 0.5);
  return (
    <div className="flex items-start justify-between gap-2">
      <span className={`text-neutral-500 shrink-0 ${labelWidth}`}>{config.display_name}</span>
      <div className="flex flex-wrap gap-1 justify-end">
        {showScore ? (
          <ScoreTag score={score} colors={colors} />
        ) : (
          <span className="text-neutral-600 italic">—</span>
        )}
      </div>
    </div>
  );
}

interface ExpandableValueTagProps {
  name: string;
  isKnown: boolean;
  tagClass: string;
  showValidation: boolean;
}

function ExpandableValueTag({
  name,
  isKnown,
  tagClass,
  showValidation,
}: Readonly<ExpandableValueTagProps>) {
  return (
    <span key={name} className={tagClass} title={isKnown ? undefined : 'Not in reference table'}>
      {name}
      {!isKnown && showValidation && ' ⚠️'}
    </span>
  );
}

function getExpandableTagClass(isKnown: boolean, colors: TagColors): string {
  return isKnown
    ? `px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`
    : 'px-1.5 py-0.5 rounded bg-red-500/30 text-red-300 border border-red-500/50';
}

interface ExpandableValuesListProps {
  values: string[];
  lookupSet: Set<string> | null;
  colors: TagColors;
  showValidation: boolean;
}

function ExpandableValuesList({
  values,
  lookupSet,
  colors,
  showValidation,
}: Readonly<ExpandableValuesListProps>) {
  if (values.length === 0) return <span className="text-neutral-600 italic">—</span>;
  return (
    <>
      {values.map((name: string) => {
        const isKnown = !lookupSet || lookupSet.has(name.toLowerCase());
        return (
          <ExpandableValueTag
            key={name}
            name={name}
            isKnown={isKnown}
            tagClass={getExpandableTagClass(isKnown, colors)}
            showValidation={showValidation}
          />
        );
      })}
    </>
  );
}

function ExpandableRow({
  config,
  payload,
  labelWidth,
  colors,
  validationLookups,
  showValidation,
}: Readonly<ConfigRowWithValidationProps>) {
  const values = extractStrings(getPayloadValue(payload, config.payload_field));
  const lookupSet = showValidation && validationLookups ? validationLookups[config.slug] : null;
  return (
    <div className="flex items-start justify-between gap-2">
      <span className={`text-neutral-500 shrink-0 ${labelWidth}`}>{config.display_name}</span>
      <div className="flex flex-wrap gap-1 justify-end">
        <ExpandableValuesList
          values={values}
          lookupSet={lookupSet}
          colors={colors}
          showValidation={showValidation}
        />
      </div>
    </div>
  );
}

interface CodeTagProps {
  code: string;
  colors: TagColors;
  lookupMap: Map<string, string> | null;
}

function CodeTag({ code, colors, lookupMap }: Readonly<CodeTagProps>) {
  return (
    <span key={code} className={`px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}>
      {lookupMap?.get(code) || code}
    </span>
  );
}

interface CodesListProps {
  codes: string[];
  colors: TagColors;
  lookupMap: Map<string, string> | null;
}

function CodesList({ codes, colors, lookupMap }: Readonly<CodesListProps>) {
  if (codes.length === 0) return <span className="text-neutral-600 italic">—</span>;
  return (
    <>
      {codes.map((code: string) => (
        <CodeTag key={code} code={code} colors={colors} lookupMap={lookupMap} />
      ))}
    </>
  );
}

function CodeBasedRow({
  config,
  payload,
  taxonomyData,
  labelWidth,
  colors,
}: Readonly<ConfigRowWithDataProps>) {
  const codes = extractCodes(getPayloadValue(payload, config.payload_field));
  const lookupMap = taxonomyData[config.slug]
    ? new Map(taxonomyData[config.slug].map((i) => [i.code, i.name]))
    : null;
  return (
    <div className="flex items-start justify-between gap-2">
      <span className={`text-neutral-500 shrink-0 ${labelWidth}`}>{config.display_name}</span>
      <div className="flex flex-wrap gap-1 justify-end">
        <CodesList codes={codes} colors={colors} lookupMap={lookupMap} />
      </div>
    </div>
  );
}

export function TagCategoryRow({
  config,
  payload,
  taxonomyData,
  labelWidth = 'w-24',
  validationLookups,
  showValidation = false,
}: Readonly<TagCategoryRowProps>) {
  const colors = COLOR_MAP[config.color] || COLOR_MAP.neutral;
  const baseProps = { config, payload, labelWidth, colors };

  if (config.behavior_type === 'scoring') {
    return <ScoringRow {...baseProps} />;
  }
  if (config.behavior_type === 'expandable') {
    return (
      <ExpandableRow
        {...baseProps}
        validationLookups={validationLookups}
        showValidation={showValidation}
      />
    );
  }
  return <CodeBasedRow {...baseProps} taxonomyData={taxonomyData} />;
}
