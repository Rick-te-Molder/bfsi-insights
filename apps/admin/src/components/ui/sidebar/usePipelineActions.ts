import { useState } from 'react';

const AGENT_API_URL = 'https://bfsi-insights.onrender.com';

export function usePipelineActions() {
  const [processingQueue, setProcessingQueue] = useState(false);
  const [triggeringBuild, setTriggeringBuild] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const showStatus = (message: string) => {
    setStatusMessage(message);
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleProcessQueue = async () => {
    setProcessingQueue(true);
    try {
      const res = await fetch('/api/process-queue', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        showStatus(`✅ ${data.processed || 0} items processed`);
      } else {
        showStatus(`❌ ${data.error || 'Failed'}`);
      }
    } catch {
      showStatus('❌ Network error');
    } finally {
      setProcessingQueue(false);
    }
  };

  const handleTriggerBuild = async () => {
    setTriggeringBuild(true);
    try {
      const res = await fetch(`${AGENT_API_URL}/api/trigger-build`, { method: 'POST' });
      if (res.ok) {
        showStatus('✅ Build triggered!');
      } else {
        showStatus('❌ Build failed');
      }
    } catch {
      showStatus('❌ Network error');
    } finally {
      setTriggeringBuild(false);
    }
  };

  return {
    processingQueue,
    triggeringBuild,
    statusMessage,
    handleProcessQueue,
    handleTriggerBuild,
  };
}
