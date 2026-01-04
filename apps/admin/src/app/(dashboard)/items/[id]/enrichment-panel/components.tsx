'use client';

import type { EnrichmentMeta, CurrentPrompt, UtilityVersion } from './types';

function UtilityVersionInfo({
  meta,
  upToDate,
  currentVersion,
  formatDate,
}: {
  meta: EnrichmentMeta;
  upToDate: boolean;
  currentVersion?: UtilityVersion;
  formatDate: (iso?: string) => string;
}) {
  return (
    <>
      <span className="text-neutral-400">v{meta.implementation_version}</span>
      {!upToDate && currentVersion && (
        <span className="text-amber-400"> → v{currentVersion.version}</span>
      )}
      <span className="text-neutral-600">
        {' '}
        · {meta.method} · {formatDate(meta.processed_at)}
      </span>
    </>
  );
}

function LLMVersionInfo({
  meta,
  upToDate,
  current,
  formatDate,
}: {
  meta?: EnrichmentMeta;
  upToDate: boolean;
  current?: CurrentPrompt;
  formatDate: (iso?: string) => string;
}) {
  return (
    <>
      {meta?.prompt_version}
      {!upToDate && current && <span className="text-amber-400"> → {current.version}</span>}
      <span className="text-neutral-600"> · {formatDate(meta?.processed_at)}</span>
    </>
  );
}

interface StepVersionInfoProps {
  meta: EnrichmentMeta | undefined;
  upToDate: boolean;
  hasMetaRun: boolean;
  isLegacy: boolean;
  current: CurrentPrompt | undefined;
  getCurrentUtilityVersion: (agentName: string) => UtilityVersion | undefined;
  agent: string;
  formatDate: (iso?: string) => string;
}

export function StepVersionInfo({
  meta,
  upToDate,
  hasMetaRun,
  isLegacy,
  current,
  getCurrentUtilityVersion,
  agent,
  formatDate,
}: StepVersionInfoProps) {
  if (meta?.agent_type === 'utility') {
    return (
      <UtilityVersionInfo
        meta={meta}
        upToDate={upToDate}
        currentVersion={getCurrentUtilityVersion(agent)}
        formatDate={formatDate}
      />
    );
  }
  if (hasMetaRun)
    return (
      <LLMVersionInfo meta={meta} upToDate={upToDate} current={current} formatDate={formatDate} />
    );
  if (isLegacy) return <span className="text-neutral-500">Legacy (no version info)</span>;
  return <span className="text-neutral-600">Not processed</span>;
}

export function StatusMessage({
  message,
}: {
  message: { type: 'success' | 'error'; text: string } | null;
}) {
  if (!message) return null;
  const cls =
    message.type === 'success'
      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
      : 'bg-red-500/10 text-red-400 border border-red-500/20';
  return (
    <div className={`mb-3 px-3 py-2 rounded-lg text-xs font-medium ${cls}`}>{message.text}</div>
  );
}

export function StatusIndicator({ statusCode }: { statusCode: number }) {
  return (
    <div className="mb-3 px-2 py-1.5 rounded bg-neutral-800/50 text-xs text-neutral-400">
      Status: <span className="font-mono text-neutral-300">{statusCode}</span>
    </div>
  );
}

function StepLabel({
  label,
  hasRun,
  upToDate,
}: {
  label: string;
  hasRun: boolean;
  upToDate: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-neutral-200">{label}</span>
      {hasRun && !upToDate && (
        <span className="text-xs text-amber-400" title="Upgrade available">
          ⬆️
        </span>
      )}
    </div>
  );
}

function StepButton({
  loading,
  stepKey,
  upToDate,
  hasRun,
  onTrigger,
}: {
  loading: string | null;
  stepKey: string;
  upToDate: boolean;
  hasRun: boolean;
  onTrigger: () => void;
}) {
  const cls = upToDate
    ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed'
    : 'bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 border border-sky-500/30';
  return (
    <button
      onClick={onTrigger}
      disabled={loading !== null || upToDate}
      className={`shrink-0 rounded px-2.5 py-1 text-xs font-medium transition-colors ${cls} disabled:opacity-50`}
    >
      {loading === stepKey ? '...' : hasRun ? 'Re-run' : 'Run'}
    </button>
  );
}

interface StepRowProps {
  label: string;
  hasRun: boolean;
  upToDate: boolean;
  loading: string | null;
  stepKey: string;
  onTrigger: () => void;
  children: React.ReactNode;
}

export function StepRow({
  label,
  hasRun,
  upToDate,
  loading,
  stepKey,
  onTrigger,
  children,
}: StepRowProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0 flex-1">
        <StepLabel label={label} hasRun={hasRun} upToDate={upToDate} />
        <div className="text-xs text-neutral-500 truncate">{children}</div>
      </div>
      <StepButton
        loading={loading}
        stepKey={stepKey}
        upToDate={upToDate}
        hasRun={hasRun}
        onTrigger={onTrigger}
      />
    </div>
  );
}

interface ReEnrichButtonProps {
  loading: string | null;
  hasAnyOutdated: boolean;
  onTrigger: () => void;
}

export function ReEnrichButton({ loading, hasAnyOutdated, onTrigger }: ReEnrichButtonProps) {
  const btnClass = hasAnyOutdated
    ? 'bg-sky-600 text-white hover:bg-sky-500'
    : 'bg-neutral-800 text-neutral-500 cursor-not-allowed';
  return (
    <div className="mt-4 pt-3 border-t border-neutral-800">
      <button
        onClick={onTrigger}
        disabled={loading !== null || !hasAnyOutdated}
        className={`w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors ${btnClass} disabled:opacity-50`}
      >
        {loading === 'enrich' ? 'Queueing...' : '🔄 Re-enrich All Outdated'}
      </button>
      {!hasAnyOutdated && (
        <p className="text-xs text-neutral-500 text-center mt-1">All steps are up to date</p>
      )}
    </div>
  );
}
