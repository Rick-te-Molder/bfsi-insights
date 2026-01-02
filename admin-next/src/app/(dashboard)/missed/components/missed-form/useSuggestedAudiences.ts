import { useCallback, useState } from 'react';

export function useSuggestedAudiences() {
  const [suggestedAudiences, setSuggestedAudiences] = useState<string[]>([]);

  const toggleAudience = useCallback((audience: string) => {
    setSuggestedAudiences((prev) => {
      if (prev.includes(audience)) return prev.filter((a) => a !== audience);
      return [...prev, audience];
    });
  }, []);

  return { suggestedAudiences, setSuggestedAudiences, toggleAudience };
}
