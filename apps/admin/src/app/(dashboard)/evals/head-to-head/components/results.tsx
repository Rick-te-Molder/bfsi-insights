'use client';

import { OutputDisplay } from '../output-display';

export interface ComparisonResult {
  itemId: string;
  title: string;
  versionA: string;
  versionB: string;
  outputA: Record<string, unknown>;
  outputB: Record<string, unknown>;
  winner?: 'A' | 'B' | 'tie';
  reasoning?: string;
}

function ResultHeader({ result }: { result: ComparisonResult }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-medium text-neutral-300">{result.title}</h3>
      <ResultMeta result={result} />
    </div>
  );
}

function ResultMeta({ result }: { result: ComparisonResult }) {
  return (
    <div className="flex gap-4 mt-2 text-xs text-neutral-500">
      <span>Version A: {result.versionA}</span>
      <span>Version B: {result.versionB}</span>
      {result.winner && <span className="text-emerald-400">Winner: {result.winner}</span>}
    </div>
  );
}

function OutputColumn({ label, output }: { label: string; output: Record<string, unknown> }) {
  return (
    <div>
      <h4 className="text-xs font-medium text-neutral-400 mb-2">{label}</h4>
      <OutputDisplay output={output} />
    </div>
  );
}

function ResultOutputs({ result }: { result: ComparisonResult }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <OutputColumn label="Output A" output={result.outputA} />
      <OutputColumn label="Output B" output={result.outputB} />
    </div>
  );
}

function ResultReasoning({ reasoning }: { reasoning: string }) {
  return (
    <div className="mt-4 pt-4 border-t border-neutral-800">
      <h4 className="text-xs font-medium text-neutral-400 mb-1">LLM Judge Reasoning</h4>
      <p className="text-sm text-neutral-300">{reasoning}</p>
    </div>
  );
}

export function ResultCard({ result }: { result: ComparisonResult }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <ResultHeader result={result} />
      <ResultOutputs result={result} />
      {result.reasoning && <ResultReasoning reasoning={result.reasoning} />}
    </div>
  );
}

export function ResultsList({ results }: { results: ComparisonResult[] }) {
  if (results.length === 0) return null;
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-white">Results</h2>
      {results.map((result) => (
        <ResultCard key={result.itemId} result={result} />
      ))}
    </div>
  );
}
