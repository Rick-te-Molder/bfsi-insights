'use client';

import { AbTestsHeader } from './ab-tests-header';
import { AbTestsStats } from './ab-tests-stats';
import { AbTestsTable } from './ab-tests-table';
import { AbTestsModals } from './ab-tests-modals';
import { useAbTestsData } from './use-ab-tests-data';
import { useAbTestsPageState } from './use-ab-tests-page-state';

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-neutral-400">Loading A/B tests...</div>
    </div>
  );
}

function useReloadHandlers(opts: {
  reload: () => Promise<void>;
  closeCreate: () => void;
  clearSelected: () => void;
}) {
  const { reload, closeCreate, clearSelected } = opts;

  const onCreated = async () => {
    closeCreate();
    await reload();
  };

  const onUpdated = async () => {
    clearSelected();
    await reload();
  };

  return { onCreated, onUpdated };
}

function useAbTestsPageController(opts: { reload: () => Promise<void> }) {
  const pageState = useAbTestsPageState();
  const handlers = useReloadHandlers({
    reload: opts.reload,
    closeCreate: pageState.closeCreate,
    clearSelected: pageState.clearSelected,
  });

  const onCreated = () => {
    handlers.onCreated().catch(() => {});
  };
  const onUpdated = () => {
    handlers.onUpdated().catch(() => {});
  };

  return { pageState, onCreated, onUpdated };
}

function AbTestsMain({
  tests,
  onCreate,
  onSelect,
}: Readonly<{
  tests: ReturnType<typeof useAbTestsData>['tests'];
  onCreate: () => void;
  onSelect: (test: ReturnType<typeof useAbTestsData>['tests'][number]) => void;
}>) {
  return (
    <>
      <AbTestsHeader onCreate={onCreate} />
      <AbTestsStats tests={tests} />
      <AbTestsTable tests={tests} onSelect={onSelect} />
    </>
  );
}

export function AbTestsPageClient() {
  const { tests, prompts, loading, agents, reload } = useAbTestsData();
  const { pageState, onCreated, onUpdated } = useAbTestsPageController({ reload });

  if (loading) return <LoadingState />;

  return (
    <>
      <AbTestsMain tests={tests} onCreate={pageState.openCreate} onSelect={pageState.selectTest} />
      <AbTestsModals
        showCreateModal={pageState.showCreateModal}
        agents={agents}
        prompts={prompts}
        selectedTest={pageState.selectedTest}
        onCloseCreate={pageState.closeCreate}
        onCreated={onCreated}
        onCloseSelected={pageState.clearSelected}
        onUpdated={onUpdated}
      />
    </>
  );
}
