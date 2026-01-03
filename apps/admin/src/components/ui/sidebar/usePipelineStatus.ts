import { useState, useEffect } from 'react';

export interface PipelineStatus {
  status: 'idle' | 'processing' | 'degraded' | 'unknown';
  processingCount: number;
  pendingReviewCount: number;
  recentFailedCount: number;
  lastQueueRun: string | null;
  lastBuildTime: string | null;
}

export function usePipelineStatus() {
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/pipeline-status');
        if (res.ok) {
          setPipelineStatus(await res.json());
        }
      } catch {
        // Silently fail - status is optional
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  return pipelineStatus;
}
