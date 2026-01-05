'use client';

function TaggedCodesSection({ codes, label }: Readonly<{ codes: unknown; label: string }>) {
  if (!Array.isArray(codes) || codes.length === 0) return null;
  return (
    <div className="mb-3">
      <div className="text-xs font-medium text-neutral-400 mb-1">{label}</div>
      <div className="flex flex-wrap gap-1">
        {codes.map((item) => {
          const code = typeof item === 'string' ? item : item?.code;
          const conf = typeof item === 'object' ? item?.confidence : null;
          return (
            <span
              key={code}
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
}

function AudienceScoresSection({ scores }: Readonly<{ scores: unknown }>) {
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
}

function NamesSection({ names, label }: Readonly<{ names: unknown; label: string }>) {
  if (!Array.isArray(names) || names.length === 0) return null;
  return (
    <div className="mb-3">
      <div className="text-xs font-medium text-neutral-400 mb-1">{label}</div>
      <div className="text-xs text-neutral-300">{names.join(', ')}</div>
    </div>
  );
}

function ConfidenceSection({ confidence }: Readonly<{ confidence: unknown }>) {
  if (typeof confidence !== 'number') return null;
  return (
    <div className="mb-3">
      <span className="text-xs text-neutral-400">Overall Confidence:</span>{' '}
      <span className="text-xs text-white font-medium">{(confidence * 100).toFixed(0)}%</span>
    </div>
  );
}

function ReasoningSection({ reasoning }: Readonly<{ reasoning: unknown }>) {
  if (!reasoning) return null;
  const text = typeof reasoning === 'string' ? reasoning : JSON.stringify(reasoning);
  return (
    <div className="mb-3">
      <div className="text-xs font-medium text-neutral-400 mb-1">Reasoning</div>
      <div className="text-xs text-neutral-300 italic">{text}</div>
    </div>
  );
}

function toNumber(val: unknown): number {
  return typeof val === 'number' ? val : 0;
}

function UsageSection({ usage }: Readonly<{ usage: unknown }>) {
  if (!usage || typeof usage !== 'object') return null;
  const u = usage as Record<string, unknown>;
  const promptTokens = toNumber(u.prompt_tokens);
  const completionTokens = toNumber(u.completion_tokens);
  const totalTokens = toNumber(u.total_tokens);
  const model = typeof u.model === 'string' ? u.model : null;
  return (
    <div className="text-xs text-neutral-500 border-t border-neutral-800 pt-2 mt-2">
      <span className="font-medium">Tokens:</span> {promptTokens} in / {completionTokens} out ={' '}
      {totalTokens} total
      {model ? <span className="ml-2">({model})</span> : null}
    </div>
  );
}

function RawDataSection({ rest }: Readonly<{ rest: Record<string, unknown> }>) {
  if (Object.keys(rest).length === 0) return null;
  return (
    <details className="mt-2">
      <summary className="text-xs text-neutral-500 cursor-pointer">Raw data</summary>
      <pre className="text-xs text-neutral-400 mt-1 overflow-auto max-h-32">
        {JSON.stringify(rest, null, 2)}
      </pre>
    </details>
  );
}

interface OutputDisplayProps {
  output: Record<string, unknown>;
}

function MainSections({ output }: Readonly<{ output: Record<string, unknown> }>) {
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
  } = output;
  return (
    <>
      <AudienceScoresSection scores={audience_scores} />
      <TaggedCodesSection codes={industry_codes} label="Industries" />
      <TaggedCodesSection codes={topic_codes} label="Topics" />
      <TaggedCodesSection codes={geography_codes} label="Geographies" />
      <TaggedCodesSection codes={process_codes} label="Processes" />
      <NamesSection names={organization_names} label="Organizations" />
      <NamesSection names={vendor_names} label="Vendors" />
      <ConfidenceSection confidence={overall_confidence} />
      <ReasoningSection reasoning={reasoning} />
      <UsageSection usage={usage} />
      <RawDataSection rest={rest} />
    </>
  );
}

export function OutputDisplay({ output }: Readonly<OutputDisplayProps>) {
  if (!output) return <span className="text-neutral-500">No output</span>;
  return (
    <div className="text-sm">
      <MainSections output={output} />
    </div>
  );
}
