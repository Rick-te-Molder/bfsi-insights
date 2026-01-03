import { useMemo } from 'react';
import { useStatus } from '@/contexts/StatusContext';

export function useStatusCodeByName(name: string) {
  const { statuses, loading } = useStatus();

  return useMemo(() => {
    const code = statuses.find((s) => s.name === name)?.code ?? null;
    return { code, loading };
  }, [loading, name, statuses]);
}
