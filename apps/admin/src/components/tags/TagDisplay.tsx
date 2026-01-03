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
  /** Show as compact inline tags, full table, or table with audience percentages */
  variant?: 'table' | 'inline' | 'table-with-percentages';
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
  // Group scoring configs by parent for audience grouping
  const audienceConfigs = taxonomyConfig.filter(
    (c) => c.behavior_type === 'scoring' && c.score_parent_slug === 'audience',
  );
  const nonAudienceConfigs = taxonomyConfig.filter(
    (c) => !(c.behavior_type === 'scoring' && c.score_parent_slug === 'audience'),
  );

  // Sort by display_order from taxonomy_config (stored in Supabase)
  const sortedNonAudienceConfigs = [...nonAudienceConfigs].sort(
    (a, b) => a.display_order - b.display_order,
  );

  // KB-229: Helper to get audience label from source table (kb_audience) or fallback to display_name
  const getAudienceLabel = (config: TaxonomyConfig): string => {
    // Extract audience code from payload_field (e.g., 'audience_scores.executive' -> 'executive')
    const audienceCode = config.payload_field.split('.').pop() || '';
    // Look up in taxonomyData if available (keyed by config slug)
    const lookupData = taxonomyData[config.slug];
    if (lookupData) {
      const match = lookupData.find((item) => item.code === audienceCode);
      if (match) return match.name;
    }
    // Fallback to display_name from taxonomy_config
    return config.display_name;
  };

  // Get top audience tag (without percentages) for non-detail views
  const getTopAudiences = (
    maxCount: number = 2,
  ): { slug: string; name: string; score: number }[] => {
    const scores = audienceConfigs
      .map((c) => {
        const score = getPayloadValue(payload, c.payload_field) as number | undefined;
        return { slug: c.slug, name: getAudienceLabel(c), score: score ?? 0 };
      })
      .filter((s) => s.score >= 0.5)
      .sort((a, b) => b.score - a.score);
    return scores.slice(0, maxCount);
  };

  if (variant === 'inline') {
    // Compact inline view - show tags without labels, in correct order
    const topAudiences = getTopAudiences(1);
    const audienceColors = COLOR_MAP.violet;

    return (
      <div className="flex flex-wrap gap-1">
        {/* Primary audience tag first (no percentages) */}
        {topAudiences.map((aud) => (
          <span
            key={aud.slug}
            className={`px-1.5 py-0.5 rounded text-xs ${audienceColors.bg} ${audienceColors.text}`}
          >
            {aud.name}
          </span>
        ))}
        {/* Other tags in order */}
        {sortedNonAudienceConfigs
          .filter((c) => c.behavior_type !== 'scoring')
          .map((config) => {
            const colors = COLOR_MAP[config.color] || COLOR_MAP.neutral;
            let codes =
              config.behavior_type === 'expandable'
                ? extractStrings(getPayloadValue(payload, config.payload_field))
                : extractCodes(getPayloadValue(payload, config.payload_field));
            const lookupMap = taxonomyData[config.slug]
              ? new Map(taxonomyData[config.slug].map((i) => [i.code, i.name]))
              : null;

            // Geography: default to 'Global' if empty
            if (config.slug === 'geography' && codes.length === 0) {
              codes = ['global'];
            }

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

  // Show percentages only in detail view
  const showPercentages = variant === 'table-with-percentages';

  // Table view - full display with labels, ordered correctly
  // Order: audience first, then geography, industry, topic, process, regulator, regulation, organization, vendor
  return (
    <div className="space-y-2 text-xs">
      {/* Audience first */}
      {audienceConfigs.length > 0 && (
        <div className="flex items-start justify-between gap-2">
          <span className={`text-neutral-500 shrink-0 ${labelWidth}`}>Audience</span>
          <div className="flex flex-wrap gap-1 justify-end">
            {(() => {
              const colors = COLOR_MAP.violet;

              if (showPercentages) {
                // Detail view: show all with percentages
                const hasAnyScore = audienceConfigs.some((c) => {
                  const score = getPayloadValue(payload, c.payload_field) as number | undefined;
                  return score !== undefined && score >= (c.score_threshold ?? 0.5);
                });

                if (!hasAnyScore) {
                  return <span className="text-neutral-600 italic">—</span>;
                }

                return audienceConfigs.map((c) => {
                  const score = getPayloadValue(payload, c.payload_field) as number | undefined;
                  if (score === undefined || score < (c.score_threshold ?? 0.5)) return null;
                  return (
                    <span
                      key={c.slug}
                      className={`px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}
                    >
                      {getAudienceLabel(c)} ({(score * 100).toFixed(0)}%)
                    </span>
                  );
                });
              } else {
                // Main views: show top 1 without percentages
                const topAudiences = getTopAudiences(1);
                if (topAudiences.length === 0) {
                  return <span className="text-neutral-600 italic">—</span>;
                }
                return topAudiences.map((aud) => (
                  <span
                    key={aud.slug}
                    className={`px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}
                  >
                    {aud.name}
                  </span>
                ));
              }
            })()}
          </div>
        </div>
      )}

      {/* Other categories in specified order */}
      {sortedNonAudienceConfigs.map((config) => {
        // For geography, ensure we always show something
        if (config.slug === 'geography') {
          const codes = extractCodes(getPayloadValue(payload, config.payload_field));
          const colors = COLOR_MAP[config.color] || COLOR_MAP.neutral;
          const lookupMap = taxonomyData[config.slug]
            ? new Map(taxonomyData[config.slug].map((i) => [i.code, i.name]))
            : null;
          const displayCodes = codes.length > 0 ? codes : ['global'];

          return (
            <div key={config.slug} className="flex items-start justify-between gap-2">
              <span className={`text-neutral-500 shrink-0 ${labelWidth}`}>
                {config.display_name}
              </span>
              <div className="flex flex-wrap gap-1 justify-end">
                {displayCodes.map((code) => (
                  <span key={code} className={`px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                    {lookupMap?.get(code) || code}
                  </span>
                ))}
              </div>
            </div>
          );
        }

        return (
          <TagCategoryRow
            key={config.slug}
            config={config}
            payload={payload}
            taxonomyData={taxonomyData}
            labelWidth={labelWidth}
            validationLookups={validationLookups}
            showValidation={showValidation}
          />
        );
      })}
    </div>
  );
}
