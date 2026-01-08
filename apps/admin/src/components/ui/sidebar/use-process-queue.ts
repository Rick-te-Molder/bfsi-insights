import { useState, useCallback } from 'react';

export function useProcessQueue(showStatus: (msg: string) => void) {
  const [processingQueue, setProcessingQueue] = useState(false);

  const handleProcessQueue = useCallback(async () => {
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
  }, [showStatus]);

  return { processingQueue, handleProcessQueue };
}
