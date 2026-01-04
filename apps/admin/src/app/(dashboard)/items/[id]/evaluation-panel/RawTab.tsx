'use client';

interface RawTabProps {
  payload: Record<string, unknown>;
}

export function RawTab({ payload }: Readonly<RawTabProps>) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide">
        Raw Payload Data
      </h3>
      <pre className="text-xs text-neutral-400 bg-neutral-800/50 rounded-lg p-4 max-h-96 overflow-auto font-mono">
        {JSON.stringify(payload, null, 2)}
      </pre>
    </div>
  );
}
