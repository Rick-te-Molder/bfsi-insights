'use client';

import { MarkdownRenderer } from '@/components/ui/markdown-renderer';

const SUMMARY_SPECS = {
  short: { min: 100, max: 150, label: 'Short' },
  medium: { min: 250, max: 350, label: 'Medium' },
  long: { min: 600, max: 800, label: 'Long' },
};

function getLengthStatus(actual: number, min: number, max: number): 'ok' | 'short' | 'long' {
  if (actual < min) return 'short';
  if (actual > max) return 'long';
  return 'ok';
}

function SummaryHeader({
  label,
  text,
  spec,
}: Readonly<{ label: string; text: string; spec: { min: number; max: number } }>) {
  const status = getLengthStatus(text.length, spec.min, spec.max);
  const statusColors = { ok: 'text-emerald-400', short: 'text-amber-400', long: 'text-red-400' };
  const statusIcons = { ok: '✓', short: '↓', long: '↑' };
  return (
    <div className="flex items-center justify-between mb-1">
      <span className="text-xs font-medium text-neutral-400">{label}</span>
      <span className={`text-xs ${statusColors[status]}`}>
        {statusIcons[status]} {text.length} chars (spec: {spec.min}-{spec.max})
      </span>
    </div>
  );
}

function SummaryContent({ text, useMarkdown }: Readonly<{ text: string; useMarkdown: boolean }>) {
  if (useMarkdown)
    return (
      <MarkdownRenderer
        content={text}
        className="prose prose-invert prose-sm max-w-none prose-headings:text-neutral-200 prose-headings:font-semibold prose-headings:text-sm prose-p:my-1 prose-ul:my-1 prose-li:my-0 text-neutral-300"
      />
    );
  return <p className="text-sm text-neutral-300 leading-relaxed">{text}</p>;
}

function SummaryBlock({
  label,
  text,
  spec,
  useMarkdown = false,
}: Readonly<{
  label: string;
  text?: string;
  spec: { min: number; max: number; label: string };
  useMarkdown?: boolean;
}>) {
  if (!text) return null;
  return (
    <div className="border-b border-neutral-700/50 pb-3 last:border-0">
      <SummaryHeader label={label} text={text} spec={spec} />
      <SummaryContent text={text} useMarkdown={useMarkdown} />
    </div>
  );
}

function OriginalContentPanel({ rawContent }: Readonly<{ rawContent: string }>) {
  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-800/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-neutral-300">Original Content</span>
        <span className="text-xs text-neutral-500">{rawContent.length.toLocaleString()} chars</span>
      </div>
      <div className="text-sm text-neutral-400 max-h-[500px] overflow-y-auto">
        {rawContent ? (
          <pre className="whitespace-pre-wrap font-sans leading-relaxed">
            {rawContent.slice(0, 5000)}
            {rawContent.length > 5000 && '\n\n... [truncated]'}
          </pre>
        ) : (
          <p className="text-neutral-600 italic">No raw content available</p>
        )}
      </div>
    </div>
  );
}

function SummariesPanel({
  summary,
}: Readonly<{ summary: { short?: string; medium?: string; long?: string } }>) {
  return (
    <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-sky-300">AI Summaries</span>
      </div>
      <div className="space-y-4">
        <SummaryBlock label="Short" text={summary.short} spec={SUMMARY_SPECS.short} />
        <SummaryBlock label="Medium" text={summary.medium} spec={SUMMARY_SPECS.medium} />
        <SummaryBlock label="Long" text={summary.long} spec={SUMMARY_SPECS.long} useMarkdown />
        {!summary.short && !summary.medium && !summary.long && (
          <p className="text-neutral-600 italic text-center py-4">No summaries generated yet</p>
        )}
      </div>
    </div>
  );
}

function CompressionStat({ value, label }: Readonly<{ value: string; label: string }>) {
  return (
    <div>
      <div className="text-lg font-bold text-white">{value}</div>
      <div className="text-xs text-neutral-500">{label}</div>
    </div>
  );
}

function CompressionStats({
  rawContent,
  summaryLong,
}: Readonly<{ rawContent: string; summaryLong: string }>) {
  const compressionPct = Math.round((1 - summaryLong.length / rawContent.length) * 100);
  const ratio = Math.round(rawContent.length / summaryLong.length);
  const words = `${rawContent.split(/\s+/).length} → ${summaryLong.split(/\s+/).length}`;
  return (
    <div className="rounded-lg bg-neutral-800/30 p-4">
      <h4 className="text-xs font-medium text-neutral-400 uppercase mb-2">Compression Stats</h4>
      <div className="grid grid-cols-3 gap-4 text-center">
        <CompressionStat value={`${compressionPct}%`} label="Compression" />
        <CompressionStat value={`${ratio}:1`} label="Ratio" />
        <CompressionStat value={words} label="Words" />
      </div>
    </div>
  );
}

interface CompareTabProps {
  rawContent: string;
  summary: { short?: string; medium?: string; long?: string };
}

export function CompareTab({ rawContent, summary }: Readonly<CompareTabProps>) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide">
        Original vs AI Summary
      </h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <OriginalContentPanel rawContent={rawContent} />
        <SummariesPanel summary={summary} />
      </div>
      {rawContent && summary.long && (
        <CompressionStats rawContent={rawContent} summaryLong={summary.long} />
      )}
    </div>
  );
}
