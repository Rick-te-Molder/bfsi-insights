'use client';

import { DiscoveryControlCardView } from './DiscoveryControlCardView';
import { useDiscoveryControl } from './useDiscoveryControl';

export function DiscoveryControlCard() {
  const model = useDiscoveryControl();

  return (
    <DiscoveryControlCardView
      status={model.status}
      toggling={model.toggling}
      processing={model.processing}
      batchSize={model.batchSize}
      onChangeBatchSize={model.setBatchSize}
      onToggle={model.toggleDiscovery}
      onRun={model.runBatch}
      error={model.error}
      result={model.result}
    />
  );
}
