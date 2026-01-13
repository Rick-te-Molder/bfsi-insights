'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageHeader, LoadingState } from '../components';
import { useHeadToHeadData } from './hooks/useHeadToHeadData';
import { useComparison } from './hooks/useComparison';
import { useComparisonState } from './hooks/useComparisonState';
import { useDerivedData } from './hooks/useDerivedData';
import { ResultsList, HeadToHeadForm } from './components/index';

function useRunHandler(
  state: ReturnType<typeof useComparisonState>,
  runComparison: ReturnType<typeof useComparison>['runComparison'],
) {
  return () =>
    runComparison({
      selectedAgent: state.selectedAgent,
      versionA: state.versionA,
      versionB: state.versionB,
      selectedItem: state.selectedItem,
      useLLMJudge: state.useLLMJudge,
      setResults: state.setResults,
    });
}

function HeadToHeadContent() {
  const searchParams = useSearchParams();
  const { prompts, items, statuses, loading } = useHeadToHeadData();
  const { running, runComparison } = useComparison();
  const state = useComparisonState(searchParams.get('item') || '');
  const { agents, agentPrompts, filteredItems } = useDerivedData(prompts, items, state);
  const handleRun = useRunHandler(state, runComparison);

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Head-to-Head Comparison"
        description="Run the same input through two prompt versions and compare outputs side-by-side"
      />
      <HeadToHeadForm
        agents={agents}
        agentPrompts={agentPrompts}
        statuses={statuses}
        filteredItems={filteredItems}
        state={state}
        onRun={handleRun}
        running={running}
      />
      <ResultsList results={state.results} />
    </div>
  );
}

export function HeadToHeadPageClient() {
  return (
    <Suspense fallback={<LoadingState />}>
      <HeadToHeadContent />
    </Suspense>
  );
}
