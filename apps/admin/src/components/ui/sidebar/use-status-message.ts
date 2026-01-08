import { useState, useCallback } from 'react';

export function useStatusMessage() {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const showStatus = useCallback((message: string) => {
    setStatusMessage(message);
    setTimeout(() => setStatusMessage(null), 4000);
  }, []);

  return { statusMessage, showStatus };
}
