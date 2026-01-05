'use client';

import type { QueueItem } from '@bfsi/types';
import { STEP_CONFIG, type CurrentPrompt, type UtilityVersion, type EnrichmentMeta } from './types';
import { useEnrichmentActions } from './useEnrichmentActions';
import {
  StepVersionInfo,
  StatusMessage,
  StatusIndicator,
  StepRow,
  ReEnrichButton,
} from './components';

interface EnrichmentPanelProps {
  item: QueueItem;
  currentPrompts: CurrentPrompt[];
  utilityVersions?: UtilityVersion[];
}

function hasStepOutput(payload: QueueItem['payload'], stepKey: string): boolean {
  if (!payload) return false;
  if (stepKey === 'summarize') return !!(payload.summary || payload.title);
  if (stepKey === 'tag') return !!(payload.industry_codes?.length || payload.topic_codes?.length);
  if (stepKey === 'thumbnail') return !!(payload.thumbnail_url || payload.thumbnail);
  return false;
}

function formatDate(iso?: string): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function useVersionChecks(
  currentPrompts: CurrentPrompt[],
  utilityVersions: UtilityVersion[],
  enrichmentMeta: Record<string, EnrichmentMeta>,
) {
  const getCurrentPrompt = (agentName: string) =>
    currentPrompts.find((p) => p.agent_name === agentName);
  const getCurrentUtilityVersion = (agentName: string) =>
    utilityVersions.find((v) => v.agent_name === agentName);

  const isUpToDate = (stepKey: string, agentName: string) => {
    const meta = enrichmentMeta[stepKey];
    if (meta?.agent_type === 'utility') {
      const cv = getCurrentUtilityVersion(agentName);
      return cv && meta.implementation_version ? meta.implementation_version === cv.version : false;
    }
    const current = getCurrentPrompt(agentName);
    return meta?.prompt_version_id && current ? meta.prompt_version_id === current.id : false;
  };

  return { getCurrentPrompt, getCurrentUtilityVersion, isUpToDate };
}

interface StepsContext {
  item: QueueItem;
  loading: string | null;
  triggerStep: (key: string) => void;
  enrichmentMeta: Record<string, EnrichmentMeta>;
  checks: ReturnType<typeof useVersionChecks>;
}

function useStepState(step: (typeof STEP_CONFIG)[number], ctx: StepsContext) {
  const meta = ctx.enrichmentMeta[step.key];
  const upToDate = ctx.checks.isUpToDate(step.key, step.agent);
  const hasMetaRun = !!meta?.prompt_version;
  const hasLegacy = hasStepOutput(ctx.item.payload, step.key);
  return { meta, upToDate, hasMetaRun, hasLegacy };
}

function StepItemContent({
  step,
  ctx,
}: Readonly<{ step: (typeof STEP_CONFIG)[number]; ctx: StepsContext }>) {
  const { meta, upToDate, hasMetaRun, hasLegacy } = useStepState(step, ctx);
  return (
    <StepRow
      key={step.key}
      label={step.label}
      hasRun={hasMetaRun || hasLegacy}
      upToDate={upToDate}
      loading={ctx.loading}
      stepKey={step.key}
      onTrigger={() => ctx.triggerStep(step.key)}
    >
      <StepVersionInfo
        meta={meta}
        upToDate={upToDate}
        hasMetaRun={hasMetaRun}
        isLegacy={!hasMetaRun && hasLegacy}
        current={ctx.checks.getCurrentPrompt(step.agent)}
        getCurrentUtilityVersion={ctx.checks.getCurrentUtilityVersion}
        agent={step.agent}
        formatDate={formatDate}
      />
    </StepRow>
  );
}

function StepsList(ctx: Readonly<StepsContext>) {
  return (
    <div className="space-y-3">
      {STEP_CONFIG.map((step) => (
        <StepItemContent key={step.key} step={step} ctx={ctx} />
      ))}
    </div>
  );
}

function checkHasAnyOutdated(
  item: QueueItem,
  enrichmentMeta: Record<string, EnrichmentMeta>,
  isUpToDate: (k: string, a: string) => boolean,
) {
  return STEP_CONFIG.some(({ key, agent }) => {
    if (enrichmentMeta[key]) return !isUpToDate(key, agent);
    if (hasStepOutput(item.payload, key)) return true;
    return false;
  });
}

function PanelContent({
  item,
  currentPrompts,
  utilityVersions,
  actions,
}: Readonly<EnrichmentPanelProps & { actions: ReturnType<typeof useEnrichmentActions> }>) {
  const enrichmentMeta = (item.payload?.enrichment_meta || {}) as Record<string, EnrichmentMeta>;
  const checks = useVersionChecks(currentPrompts, utilityVersions || [], enrichmentMeta);
  const hasAnyOutdated = checkHasAnyOutdated(item, enrichmentMeta, checks.isUpToDate);
  return (
    <>
      <StatusMessage message={actions.message} />
      <StatusIndicator statusCode={item.status_code} />
      <StepsList
        item={item}
        loading={actions.loading}
        triggerStep={actions.triggerStep}
        enrichmentMeta={enrichmentMeta}
        checks={checks}
      />
      <ReEnrichButton
        loading={actions.loading}
        hasAnyOutdated={hasAnyOutdated}
        onTrigger={actions.triggerEnrichAll}
      />
    </>
  );
}

export function EnrichmentPanel({
  item,
  currentPrompts,
  utilityVersions = [],
}: Readonly<EnrichmentPanelProps>) {
  const actions = useEnrichmentActions(item);
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-4">
        Enrichment
      </h3>
      <PanelContent
        item={item}
        currentPrompts={currentPrompts}
        utilityVersions={utilityVersions}
        actions={actions}
      />
    </div>
  );
}
