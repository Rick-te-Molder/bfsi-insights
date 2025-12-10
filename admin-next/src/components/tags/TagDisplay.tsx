'use client';

import { TaxonomyConfig, TaxonomyData, TagPayload, ValidationLookups } from './types';

// Color map for Tailwind classes
const COLOR_MAP: Record<string, { bg: string; text: string }> = {
  blue: { bg: 'bg-blue-500/10', text: 'text-blue-300' },
  purple: { bg: 'bg-purple-500/10', text: 'text-purple-300' },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-300' },
  amber: { bg: 'bg-amber-500/10', text: 'text-amber-300' },
  red: { bg: 'bg-red-500/10', text: 'text-red-300' },
  orange: { bg: 'bg-orange-500/10', text: 'text-orange-300' },
  cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-300' },
  pink: { bg: 'bg-pink-500/10', text: 'text-pink-300' },
  violet: { bg: 'bg-violet-500/10', text: 'text-violet-300' },
  neutral: { bg: 'bg-neutral-500/10', text: 'text-neutral-300' },
};

interface TaggedCode {
  code: string;
  confidence?: number;
}

interface TagDisplayProps {
  payload: TagPayload;
  taxonomyConfig: TaxonomyConfig[];
  taxonomyData: TaxonomyData;
  /** Show as compact inline tags or full table */
  variant?: 'table' | 'inline';
  /** Label width for table variant */
  labelWidth?: string;
  /** Optional validation lookups for expandable types - keyed by taxonomy slug */
  validationLookups?: ValidationLookups;
  /** Show validation warnings for unknown entities */
  showValidation?: boolean;
}

/**
 * Extract values from a payload field path (e.g., "industry_codes" or "audience_scores.executive")
 */
function getPayloadValue(payload: TagPayload, fieldPath: string): unknown {
  const parts = fieldPath.split('.');
  let value: unknown = payload;
  for (const part of parts) {
    if (value && typeof value === 'object' && part in value) {
      value = (value as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return value;
}

/**
 * Extract codes from tagged items (handles both string[] and {code, confidence}[])
 */
function extractCodes(items: unknown): string[] {
  if (!items || !Array.isArray(items)) return [];
  return items
    .map((item) =>
      typeof item === 'object' && item !== null ? (item as TaggedCode).code : (item as string),
    )
    .filter((c): c is string => typeof c === 'string' && c !== 'null' && c !== '');
}

/**
 * Extract string array (for expandable types like vendor_names)
 */
function extractStrings(items: unknown): string[] {
  if (!items || !Array.isArray(items)) return [];
  return items.filter((s): s is string => typeof s === 'string' && s !== 'null' && s !== '');
}

/**
 * Renders a single tag category row
 */
function TagCategoryRow({
  config,
  payload,
  taxonomyData,
  labelWidth = 'w-24',
  validationLookups,
  showValidation = false,
}: {
  config: TaxonomyConfig;
  payload: TagPayload;
  taxonomyData: TaxonomyData;
  labelWidth?: string;
  validationLookups?: ValidationLookups;
  showValidation?: boolean;
}) {
  const colors = COLOR_MAP[config.color] || COLOR_MAP.neutral;
  const lookupMap = taxonomyData[config.slug]
    ? new Map(taxonomyData[config.slug].map((i) => [i.code, i.name]))
    : null;

  // Handle different behavior types
  if (config.behavior_type === 'scoring') {
    const score = getPayloadValue(payload, config.payload_field) as number | undefined;
    const threshold = config.score_threshold ?? 0.5;
    const showScore = score !== undefined && score >= threshold;

    return (
      <div className="flex items-start justify-between gap-2">
        <span className={`text-neutral-500 shrink-0 ${labelWidth}`}>{config.display_name}</span>
        <div className="flex flex-wrap gap-1 justify-end">
          {showScore ? (
            <span className={`px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}>
              {(score * 100).toFixed(0)}%
            </span>
          ) : (
            <span className="text-neutral-600 italic">—</span>
          )}
        </div>
      </div>
    );
  }

  if (config.behavior_type === 'expandable') {
    // Free-text values (vendor_names, organization_names)
    const values = extractStrings(getPayloadValue(payload, config.payload_field));
    const lookupSet = showValidation && validationLookups ? validationLookups[config.slug] : null;

    return (
      <div className="flex items-start justify-between gap-2">
        <span className={`text-neutral-500 shrink-0 ${labelWidth}`}>{config.display_name}</span>
        <div className="flex flex-wrap gap-1 justify-end">
          {values.length > 0 ? (
            values.map((name, i) => {
              const isKnown = !lookupSet || lookupSet.has(name.toLowerCase());
              const tagClass = isKnown
                ? `px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`
                : 'px-1.5 py-0.5 rounded bg-red-500/30 text-red-300 border border-red-500/50';
              return (
                <span
                  key={i}
                  className={tagClass}
                  title={isKnown ? undefined : 'Not in reference table'}
                >
                  {name}
                  {!isKnown && showValidation && ' ⚠️'}
                </span>
              );
            })
          ) : (
            <span className="text-neutral-600 italic">—</span>
          )}
        </div>
      </div>
    );
  }

  // Guardrail: code-based taxonomy
  const codes = extractCodes(getPayloadValue(payload, config.payload_field));
  return (
    <div className="flex items-start justify-between gap-2">
      <span className={`text-neutral-500 shrink-0 ${labelWidth}`}>{config.display_name}</span>
      <div className="flex flex-wrap gap-1 justify-end">
        {codes.length > 0 ? (
          codes.map((code) => (
            <span key={code} className={`px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}>
              {lookupMap?.get(code) || code}
            </span>
          ))
        ) : (
          <span className="text-neutral-600 italic">—</span>
        )}
      </div>
    </div>
  );
}

/**
 * Dynamic tag display component that renders all taxonomy categories from config
 */
export function TagDisplay({
  payload,
  taxonomyConfig,
  taxonomyData,
  variant = 'table',
  labelWidth = 'w-24',
  validationLookups,
  showValidation = false,
}: TagDisplayProps) {
  // Group scoring configs by parent for persona grouping
  const personaConfigs = taxonomyConfig.filter(
    (c) => c.behavior_type === 'scoring' && c.score_parent_slug === 'persona',
  );
  const nonPersonaConfigs = taxonomyConfig.filter(
    (c) => !(c.behavior_type === 'scoring' && c.score_parent_slug === 'persona'),
  );

  if (variant === 'inline') {
    // Compact inline view - just show tags without labels
    return (
      <div className="flex flex-wrap gap-1">
        {taxonomyConfig
          .filter((c) => c.behavior_type !== 'scoring')
          .map((config) => {
            const colors = COLOR_MAP[config.color] || COLOR_MAP.neutral;
            const codes =
              config.behavior_type === 'expandable'
                ? extractStrings(getPayloadValue(payload, config.payload_field))
                : extractCodes(getPayloadValue(payload, config.payload_field));
            const lookupMap = taxonomyData[config.slug]
              ? new Map(taxonomyData[config.slug].map((i) => [i.code, i.name]))
              : null;

            return codes.slice(0, 2).map((code, i) => (
              <span
                key={`${config.slug}-${i}`}
                className={`px-1.5 py-0.5 rounded text-xs ${colors.bg} ${colors.text}`}
              >
                {lookupMap?.get(code) || code}
              </span>
            ));
          })}
      </div>
    );
  }

  // Table view - full display with labels
  return (
    <div className="space-y-2 text-xs">
      {/* Non-persona categories */}
      {nonPersonaConfigs.map((config) => (
        <TagCategoryRow
          key={config.slug}
          config={config}
          payload={payload}
          taxonomyData={taxonomyData}
          labelWidth={labelWidth}
          validationLookups={validationLookups}
          showValidation={showValidation}
        />
      ))}

      {/* Persona scores grouped together */}
      {personaConfigs.length > 0 && (
        <div className="flex items-start justify-between gap-2">
          <span className={`text-neutral-500 shrink-0 ${labelWidth}`}>Persona</span>
          <div className="flex flex-wrap gap-1 justify-end">
            {(() => {
              const colors = COLOR_MAP.violet;
              const hasAnyScore = personaConfigs.some((c) => {
                const score = getPayloadValue(payload, c.payload_field) as number | undefined;
                return score !== undefined && score >= (c.score_threshold ?? 0.5);
              });

              if (!hasAnyScore) {
                return <span className="text-neutral-600 italic">—</span>;
              }

              return personaConfigs.map((c) => {
                const score = getPayloadValue(payload, c.payload_field) as number | undefined;
                if (score === undefined || score < (c.score_threshold ?? 0.5)) return null;
                return (
                  <span
                    key={c.slug}
                    className={`px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}
                  >
                    {c.display_name} ({(score * 100).toFixed(0)}%)
                  </span>
                );
              });
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
