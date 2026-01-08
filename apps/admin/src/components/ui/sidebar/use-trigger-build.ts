import { useState, useCallback } from 'react';

const AGENT_API_URL = 'https://bfsi-insights.onrender.com';

export function useTriggerBuild(showStatus: (msg: string) => void) {
  const [triggeringBuild, setTriggeringBuild] = useState(false);

  const handleTriggerBuild = useCallback(async () => {
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
  }, [showStatus]);

  return { triggeringBuild, handleTriggerBuild };
}
