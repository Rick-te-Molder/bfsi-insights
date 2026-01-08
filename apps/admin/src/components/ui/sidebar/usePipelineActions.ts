import { useProcessQueue } from './use-process-queue';
import { useTriggerBuild } from './use-trigger-build';
import { useStatusMessage } from './use-status-message';

export function usePipelineActions() {
  const { statusMessage, showStatus } = useStatusMessage();
  const { processingQueue, handleProcessQueue } = useProcessQueue(showStatus);
  const { triggeringBuild, handleTriggerBuild } = useTriggerBuild(showStatus);

  return {
    processingQueue,
    triggeringBuild,
    statusMessage,
    handleProcessQueue,
    handleTriggerBuild,
  };
}
