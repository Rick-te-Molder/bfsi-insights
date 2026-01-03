'use client';

interface OutputDisplayProps {
  output: Record<string, unknown>;
}

export function OutputDisplay({ output }: OutputDisplayProps) {
  if (!output) return <span className="text-neutral-500">No output</span>;

  const {
    audience_scores,
    industry_codes,
    topic_codes,
    geography_codes,
    process_codes,
    organization_names,
    vendor_names,
    overall_confidence,
    reasoning,
    usage,
    ...rest
  } = output as Record<string, unknown>;

  const renderTaggedCodes = (codes: unknown, label: string) => {
    if (!Array.isArray(codes) || codes.length === 0) return null;
    return (
      <div className="mb-3">
        <div className="text-xs font-medium text-neutral-400 mb-1">{label}</div>
        <div className="flex flex-wrap gap-1">
          {codes.map((item, i) => {
            const code = typeof item === 'string' ? item : item?.code;
            const conf = typeof item === 'object' ? item?.confidence : null;
            return (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-neutral-800 text-neutral-200"
              >
                {code}
                {conf !== null && (
                  <span className="text-neutral-500">({(conf * 100).toFixed(0)}%)</span>
                )}
              </span>
            );
          })}
        </div>
      </div>
    );
  };

  const renderAudienceScores = (scores: unknown) => {
    if (!scores || typeof scores !== 'object') return null;
    const s = scores as Record<string, number>;
    return (
      <div className="mb-3">
        <div className="text-xs font-medium text-neutral-400 mb-1">Audience Scores</div>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(s).map(([key, value]) => (
            <div key={key} className="text-xs">
              <span className="text-neutral-400 capitalize">{key}:</span>{' '}
              <span className="text-white font-medium">{(value * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderUsage = (u: unknown) => {
    if (!u || typeof u !== 'object') return null;
    const usageData = u as Record<string, unknown>;
    return (
      <div className="text-xs text-neutral-500 border-t border-neutral-800 pt-2 mt-2">
        <span className="font-medium">Tokens:</span> {String(usageData.prompt_tokens || 0)} in /{' '}
        {String(usageData.completion_tokens || 0)} out = {String(usageData.total_tokens || 0)} total
        {usageData.model ? <span className="ml-2">({String(usageData.model)})</span> : null}
      </div>
    );
  };

  return (
    <div className="text-sm">
      {renderAudienceScores(audience_scores)}
      {renderTaggedCodes(industry_codes, 'Industries')}
      {renderTaggedCodes(topic_codes, 'Topics')}
      {renderTaggedCodes(geography_codes, 'Geographies')}
      {renderTaggedCodes(process_codes, 'Processes')}
      {Array.isArray(organization_names) && organization_names.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-medium text-neutral-400 mb-1">Organizations</div>
          <div className="text-xs text-neutral-300">{organization_names.join(', ')}</div>
        </div>
      )}
      {Array.isArray(vendor_names) && vendor_names.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-medium text-neutral-400 mb-1">Vendors</div>
          <div className="text-xs text-neutral-300">{vendor_names.join(', ')}</div>
        </div>
      )}
      {typeof overall_confidence === 'number' && (
        <div className="mb-3">
          <span className="text-xs text-neutral-400">Overall Confidence:</span>{' '}
          <span className="text-xs text-white font-medium">
            {(overall_confidence * 100).toFixed(0)}%
          </span>
        </div>
      )}
      {reasoning ? (
        <div className="mb-3">
          <div className="text-xs font-medium text-neutral-400 mb-1">Reasoning</div>
          <div className="text-xs text-neutral-300 italic">{String(reasoning)}</div>
        </div>
      ) : null}
      {renderUsage(usage)}
      {Object.keys(rest).length > 0 && (
        <details className="mt-2">
          <summary className="text-xs text-neutral-500 cursor-pointer">Raw data</summary>
          <pre className="text-xs text-neutral-400 mt-1 overflow-auto max-h-32">
            {JSON.stringify(rest, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
